(function () {
    "use strict";
    let app, courses = [], currentCourse, completed = [], certificate = null, activeLesson = 0, busy = false;
    const ru = () => document.documentElement.lang === "ru";
    const label = (en, russian) => ru() ? russian : en;
    const local = value => typeof value === "string" ? value : value?.[ru() ? "ru" : "en"] || value?.en || "";
    const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const title = course => escape(local(course.title));
    const client = () => {
        const value = app.client();
        if (!value) throw new Error(label("Cannot connect to the learning service. Please reload and try again.", "Не удалось подключиться к сервису обучения. Обновите страницу и попробуйте снова."));
        return value;
    };
    async function request(query) { const { data, error } = await query; if (error) throw error; return data; }
    function fail(error) { app.notify(label("Could not save or load learning data. Please try again. ", "Не удалось загрузить или сохранить данные обучения. Попробуйте ещё раз. ") + (error.message || ""), "danger"); }
    const link = (page, id) => `${page}?course=${encodeURIComponent(id)}`;
    const progress = () => certificate ? 100 : Math.round(80 * completed.length / currentCourse.lessons.length);
    function requireUser(next) {
        if (app.user()?.id) return true;
        location.assign(`login.html?next=${encodeURIComponent(next)}`);
        return false;
    }
    function errorPage(host, error) {
        host.innerHTML = `<div class="alert alert-danger" role="alert"><h2>${label("Unable to load", "Не удалось загрузить")}</h2><p>${escape(error.message)}</p><button class="btn btn-primary" id="learning-retry">${label("Try again", "Повторить")}</button></div>`;
        host.querySelector("button").addEventListener("click", () => location.reload());
    }
    async function init(context) {
        app = context;
        const response = await fetch("data/courses.json?v=learning-1");
        if (!response.ok) throw new Error(label("Course materials could not be loaded.", "Не удалось загрузить учебные материалы."));
        courses = await response.json();
        window.SecretCoderI18n?.register(Object.fromEntries(courses.flatMap(course => [[course.title.en, course.title.ru], [course.description.en, course.description.ru]])));
        document.addEventListener("secretcoder:languagechange", () => {
            if (document.getElementById("course-detail")) renderDetail();
            if (document.getElementById("learning-player") && currentCourse) renderLesson(true);
            if (document.getElementById("certificate-view") && certificate) renderCertificate();
        });
        const player = document.getElementById("learning-player");
        const detail = document.getElementById("course-detail");
        const cert = document.getElementById("certificate-view");
        if (detail) renderDetail();
        if (player) await startPlayer().catch(error => errorPage(player, error));
        if (cert) await loadCertificate().catch(error => errorPage(cert, error));
    }
    function setupCatalog() {
        document.querySelectorAll(".course-item").forEach((card, index) => {
            const course = courses[index];
            if (!course) return;
            card.dataset.courseId = course.id;
            card.innerHTML = `<a href="${link("single.html", course.id)}" class="course-cover"><span aria-hidden="true">${escape(course.icon)}</span><span class="course-cover-caption">SecretCoder</span></a><div class="p-3"><h5><a class="text-dark" href="${link("single.html", course.id)}">${escape(course.title.en)}</a></h5><p class="small">${escape(course.description.en)}</p><div class="d-flex justify-content-between small text-muted mb-3"><span>3 lessons</span><span>60 min</span></div><a class="btn btn-primary w-100" href="${link("single.html",course.id)}">View course</a></div>`;
        });
    }
    function selectedCourse() {
        const id = new URLSearchParams(location.search).get("course") || courses[0]?.id;
        return courses.find(course => course.id === id);
    }
    function renderDetail() {
        const host = document.getElementById("course-detail");
        const course = selectedCourse();
        if (!course) { host.innerHTML = `<h1>${label("Course not found", "Курс не найден")}</h1><a href="courses.html">${label("Explore courses", "Выбрать курс")}</a>`; return; }
        document.title = `${local(course.title)} — SecretCoder`;
        host.innerHTML = `<div class="row g-4"><section class="col-lg-8"><p class="learning-eyebrow">${label("Self-paced introductory course", "Вводный курс в своём темпе")}</p><h1>${title(course)}</h1><p class="lead">${escape(local(course.description))}</p><h2 class="h4 mt-4">${label("What you will learn", "Программа курса")}</h2><ol class="lesson-outline">${course.lessons.map(l => `<li><h3 class="h5">${escape(local(l.title))}</h3><p>${escape(local(l.paragraphs[0]))}</p></li>`).join("")}</ol></section><aside class="col-lg-4"><div class="learning-summary"><div class="course-symbol" aria-hidden="true">${escape(course.icon)}</div><h2 class="h4">${label("Free course", "Бесплатный курс")}</h2><p>${label("3 lessons · about 60 minutes", "3 урока · около 60 минут")}</p><p>${label("Examples, practical tasks and checkpoints in each lesson.", "Примеры, практические задания и проверка знаний в каждом уроке.")}</p><p>${label("Final test: at least 80% to pass.", "Итоговый тест: для сдачи нужно не менее 80%.")}</p><p>${label("A named certificate with a verification link after completion.", "Именной сертификат со ссылкой для проверки после завершения.")}</p><button id="enroll-learning" class="btn btn-primary w-100">${label("Start learning", "Начать обучение")}</button><p class="small text-muted mt-3">${label("Materials available in English and Russian.", "Материалы доступны на английском и русском.")}</p></div></aside></div>`;
        host.querySelector("#enroll-learning").addEventListener("click", event => enroll(course, event.currentTarget));
    }
    async function enroll(course, button) {
        if (!requireUser(link("single.html", course.id))) return;
        if (button) button.disabled = true;
        try { await request(client().rpc("enroll_learning_course", { p_course_id: course.id })); location.assign(link("learn.html",course.id)); }
        catch (error) { fail(error); if (button) button.disabled = false; }
    }
    async function renderMyCourses() {
        const host = document.getElementById("my-courses-grid");
        if (!host || !requireUser("my-courses.html")) return;
        document.getElementById("learner-name").textContent = app.user().name;
        try {
            const [mine, certificates] = await Promise.all([
                request(client().from("enrollments").select("course_id,progress").order("enrolled_at", { ascending: false })),
                request(client().from("learning_certificates").select("id,course_id"))
            ]);
            if (!mine.length) {
                host.innerHTML = '<div class="col-12 text-center py-5"><h3>No courses yet</h3><p>Choose a course and start learning.</p><a href="courses.html" class="btn btn-primary">Explore courses</a></div>';
            } else host.innerHTML = mine.map(row => {
                const course = courses.find(c => c.id === row.course_id);
                if (!course) return "";
                const cert = certificates.find(c => c.course_id === course.id);
                return `<div class="col-lg-4 col-md-6"><article class="card h-100 shadow-sm border-0"><a class="course-cover" href="${link("learn.html",course.id)}"><span aria-hidden="true">${escape(course.icon)}</span></a><div class="card-body"><h5>${escape(course.title.en)}</h5><div class="progress my-3" style="height:10px"><div class="progress-bar" role="progressbar" aria-label="Course progress" aria-valuenow="${row.progress}" aria-valuemin="0" aria-valuemax="100" style="width:${row.progress}%"></div></div><p class="small text-muted">${row.progress}% complete</p><a class="btn btn-primary" href="${link("learn.html",course.id)}">${row.progress ? "Continue learning" : "Start course"}</a>${cert ? `<a class="btn btn-outline-dark mt-2" href="certificate.html?id=${encodeURIComponent(cert.id)}">View certificate</a>` : ""}</div></article></div>`;
            }).join("");
            window.SecretCoderI18n?.apply(host);
        } catch (error) { errorPage(host,error); }
    }
    async function loadState() {
        const [rows, certs] = await Promise.all([
            request(client().from("lesson_completions").select("lesson_index").eq("course_id", currentCourse.id).order("lesson_index")),
            request(client().from("learning_certificates").select("*").eq("course_id", currentCourse.id))
        ]);
        completed = rows.map(row => row.lesson_index);
        certificate = certs[0] || null;
    }
    async function startPlayer() {
        currentCourse = selectedCourse();
        if (!currentCourse) throw new Error(label("Course not found", "Курс не найден"));
        if (!requireUser(link("learn.html",currentCourse.id))) return;
        const enrollment = await request(client().from("enrollments").select("course_id").eq("course_id", currentCourse.id).maybeSingle());
        if (!enrollment) { location.replace(link("single.html",currentCourse.id)); return; }
        await loadState();
        activeLesson = Math.min(completed.length,currentCourse.lessons.length);
        renderLesson();
    }
    function questionHtml(q, i) {
        return `<fieldset class="quiz-question"><legend class="h6">${i+1}. ${escape(local(q.question))}</legend>${q.options.map((option,j) => `<label class="quiz-option"><input type="radio" name="q${i}" value="${j}" required> <span>${escape(local(option))}</span></label>`).join("")}</fieldset>`;
    }
    function renderLesson(preserve = false) {
        const host = document.getElementById("learning-player");
        const previous = new Map(preserve ? [...host.querySelectorAll("input:checked")].map(input=>[input.name,input.value]) : []);
        const practice = preserve && (host.querySelector("#practice-confirm")?.checked || false);
        const count = currentCourse.lessons.length;
        document.title = `${local(currentCourse.title)} — SecretCoder`;
        const menu = currentCourse.lessons.map((l,i) => `<button type="button" class="lesson-step ${i===activeLesson ? "active" : ""}" data-lesson="${i}" ${i>completed.length ? "disabled" : ""}>${completed.includes(i) ? "✓" : i+1}. ${escape(local(l.title))}</button>`).join("");
        const isExam = activeLesson === count;
        const lesson = currentCourse.lessons[activeLesson];
        let content;
        if (isExam && certificate) {
            content = `<div class="completion-panel"><div class="completion-check" aria-hidden="true">✓</div><h2>${label("Course completed", "Курс завершён")}</h2><p>${label("You have completed every lesson and passed the final test.", "Вы прошли все уроки и сдали итоговый тест.")}</p><a class="btn btn-primary" href="certificate.html?id=${encodeURIComponent(certificate.id)}">${label("Open certificate", "Открыть сертификат")}</a><p class="mt-3"><a href="my-courses.html">${label("Back to My Learning", "Вернуться в «Моё обучение»")}</a></p></div>`;
        } else if (isExam) {
            content = `<h2>${label("Final test", "Итоговый тест")}</h2><p>${label("Answer all 5 questions. Pass with at least 80% (4 correct answers). You can retry.", "Ответьте на все 5 вопросов. Для сдачи нужно 80% (4 правильных ответа). Можно попробовать снова.")}</p><form id="lesson-quiz">${currentCourse.exam.map(questionHtml).join("")}<button class="btn btn-primary" type="submit">${label("Submit final test", "Сдать итоговый тест")}</button></form>`;
        } else {
            content = `<p class="learning-eyebrow">${label("Lesson", "Урок")} ${activeLesson+1} / ${count}</p><h2 tabindex="-1">${escape(local(lesson.title))}</h2>${lesson.paragraphs.map(p=>`<p class="lesson-paragraph">${escape(local(p))}</p>`).join("")}<h3 class="h5 mt-4">${label("Example", "Пример")}</h3><pre class="lesson-code"><code>${escape(lesson.code)}</code></pre><div class="practice-task"><h3 class="h5">${label("Practical task", "Практическое задание")}</h3><p>${escape(local(lesson.task))}</p><label><input id="practice-confirm" type="checkbox" required form="lesson-quiz"> ${label("I have completed the practical task.", "Я выполнил(а) практическое задание.")}</label></div>${completed.includes(activeLesson) ? `<div class="alert alert-success">${label("Lesson completed. You can review it at any time.", "Урок пройден. Вы можете повторить его в любое время.")}</div><button id="lesson-next" class="btn btn-primary">${label("Next step", "Следующий шаг")}</button>` : `<h3 class="h5 mt-4">${label("Knowledge check", "Проверка знаний")}</h3><form id="lesson-quiz">${questionHtml(lesson.quiz,0)}<button class="btn btn-primary" type="submit">${label("Check and complete lesson", "Проверить и завершить урок")}</button></form>`}`;
        }
        host.innerHTML = `<div class="row g-4"><aside class="col-lg-3"><a href="my-courses.html">← ${label("My Learning", "Моё обучение")}</a><h1 class="h4 mt-3">${title(currentCourse)}</h1><p>${progress()}% ${label("complete", "завершено")}</p><div class="progress mb-3" style="height:8px"><div class="progress-bar" style="width:${progress()}%"></div></div><nav aria-label="${label("Lesson navigation","Навигация по урокам")}">${menu}<button class="lesson-step ${isExam ? "active" : ""}" data-lesson="${count}" ${completed.length<count ? "disabled" : ""}>${label("Final test & certificate", "Итоговый тест и сертификат")}</button></nav></aside><section class="col-lg-9"><article class="lesson-content">${content}<div id="quiz-feedback" class="mt-3" role="status" aria-live="polite"></div></article></section></div>`;
        host.querySelectorAll("[data-lesson]").forEach(button=>button.addEventListener("click",()=>{if(busy)return;activeLesson=Number(button.dataset.lesson);renderLesson();host.querySelector("article h2")?.focus();}));
        host.querySelector("#lesson-next")?.addEventListener("click",()=>{activeLesson++;renderLesson();});
        host.querySelector("#lesson-quiz")?.addEventListener("submit",submitQuiz);
        previous.forEach((value,name)=>{const input=host.querySelector(`input[name="${name}"][value="${value}"]`);if(input)input.checked=true;});
        const confirm=host.querySelector("#practice-confirm");if(confirm)confirm.checked=practice;
    }
    async function submitQuiz(event) {
        event.preventDefault();
        if (busy || !event.currentTarget.reportValidity()) return;
        busy=true;
        const form=event.currentTarget, button=form.querySelector("button");button.disabled=true;
        const answers=[...form.querySelectorAll("fieldset")].map(field=>Number(field.querySelector("input:checked").value));
        const exam=activeLesson===currentCourse.lessons.length;
        try {
            const params={p_course_id:currentCourse.id,p_answers:answers};if(!exam)params.p_lesson_index=activeLesson;
            const result=await request(client().rpc(exam ? "submit_learning_exam" : "submit_learning_lesson",params));
            const feedback=document.getElementById("quiz-feedback");
            if(!result.passed){
                feedback.className="alert alert-warning mt-3";
                feedback.textContent=exam ? label(`Result: ${result.score}%. Review the lessons and try again.`, `Результат: ${result.score}%. Повторите уроки и попробуйте снова.`) : label("Not quite right. Review the example and try again.", "Ответ пока неверный. Повторите пример и попробуйте снова.");
            } else { await loadState(); if(!exam)activeLesson++;renderLesson();window.scrollTo({top:0,behavior:"smooth"}); }
        } catch(error){fail(error);} finally {busy=false;button.disabled=false;}
    }
    async function loadCertificate() {
        const id=new URLSearchParams(location.search).get("id");
        if(!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error(label("Certificate not found", "Сертификат не найден"));
        certificate=await request(client().rpc("verify_learning_certificate",{p_certificate_id:id}));
        if(!certificate)throw new Error(label("Certificate not found", "Сертификат не найден"));
        renderCertificate();
    }
    function renderCertificate() {
        const host=document.getElementById("certificate-view");
        const date=new Date(certificate.issued_at).toLocaleDateString(ru()?"ru-RU":"en-GB",{day:"numeric",month:"long",year:"numeric"});
        const url=new URL(`certificate.html?id=${encodeURIComponent(certificate.id)}`,location.href).href;
        host.innerHTML=`<div class="certificate-tools"><a href="my-courses.html">← ${label("My Learning", "Моё обучение")}</a><button class="btn btn-primary" id="print-certificate">${label("Print / Save PDF", "Печать / Сохранить PDF")}</button><button class="btn btn-outline-dark" id="copy-certificate">${label("Copy verification link", "Копировать ссылку проверки")}</button><span id="copy-status" role="status"></span></div><article class="certificate-sheet"><p class="certificate-brand">SecretCoder</p><p class="learning-eyebrow">${label("Verified completion", "Завершение подтверждено")}</p><h1>${label("Certificate of completion", "Сертификат о прохождении")}</h1><p>${label("This certifies that", "Подтверждаем, что")}</p><h2 class="certificate-name">${escape(certificate.learner_name)}</h2><p>${label("has completed the introductory course", "прошёл(а) вводный курс")}</p><h3>${escape(local(certificate.course_title))}</h3><p>${label("All lessons completed · Final test", "Все уроки пройдены · Итоговый тест")}: ${certificate.score}%</p><div class="certificate-meta"><p>${label("Issued", "Выдан")}: ${escape(date)}</p><p>${label("Certificate ID", "Номер сертификата")}:<br><strong>${escape(certificate.id)}</strong></p></div><p class="certificate-note">${label("SecretCoder course completion certificate. This is not an accredited qualification.", "Сертификат прохождения курса SecretCoder. Не является дипломом об аккредитованном образовании.")}</p><a class="certificate-url" href="${escape(url)}">${escape(url)}</a></article>`;
        host.querySelector("#print-certificate").addEventListener("click",()=>window.print());
        host.querySelector("#copy-certificate").addEventListener("click",async()=>{
            try{await navigator.clipboard.writeText(url);host.querySelector("#copy-status").textContent=label("Link copied", "Ссылка скопирована");}
            catch(_){host.querySelector("#copy-status").textContent=label("Copy the address from the browser address bar.", "Скопируйте адрес из строки браузера.");}
        });
    }
    window.SecretCoderLearning={init,setupCatalog,enroll,renderMyCourses};
})();
