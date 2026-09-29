(function ($) {
    "use strict";

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();


    // Initiate the wowjs
    new WOW().init();


    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.sticky-top').css('top', '0px');
        } else {
            $('.sticky-top').css('top', '-100px');
        }
    });


    // Dropdown on mouse hover
    const $dropdown = $(".dropdown");
    const $dropdownToggle = $(".dropdown-toggle");
    const $dropdownMenu = $(".dropdown-menu");
    const showClass = "show";

    $(window).on("load resize", function () {
        if (this.matchMedia("(min-width: 992px)").matches) {
            $dropdown.hover(
                function () {
                    const $this = $(this);
                    $this.addClass(showClass);
                    $this.find($dropdownToggle).attr("aria-expanded", "true");
                    $this.find($dropdownMenu).addClass(showClass);
                },
                function () {
                    const $this = $(this);
                    $this.removeClass(showClass);
                    $this.find($dropdownToggle).attr("aria-expanded", "false");
                    $this.find($dropdownMenu).removeClass(showClass);
                }
            );
        } else {
            $dropdown.off("mouseenter mouseleave");
        }
    });


    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({ scrollTop: 0 }, 1500, 'easeInOutExpo');
        return false;
    });


    // Header carousel
    $(".header-carousel").owlCarousel({
        autoplay: true,
        smartSpeed: 1500,
        items: 1,
        dots: false,
        loop: true,
        nav: true,
        navText: [
            '<i class="bi bi-chevron-left"></i>',
            '<i class="bi bi-chevron-right"></i>'
        ]
    });


    // Testimonials carousel
    $(".testimonial-carousel").owlCarousel({
        autoplay: true,
        smartSpeed: 1000,
        center: true,
        margin: 24,
        dots: true,
        loop: true,
        nav: false,
        responsive: {
            0: {
                items: 1
            },
            768: {
                items: 2
            },
            992: {
                items: 3
            }
        }
    });

})(jQuery);

// SecretCoder MVP: authentication, enrollment, search and forms.
(function () {
    "use strict";

    let supabaseClient = null;
    let activeSession = null;

    const STORE = {
        users: "secretcoder_users_v1",
        session: "secretcoder_session_v1",
        enrollments: "secretcoder_enrollments_v1",
        messages: "secretcoder_messages_v1",
        subscribers: "secretcoder_subscribers_v1",
        applications: "secretcoder_applications_v1"
    };

    const read = (key, fallback) => {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch (_) { return fallback; }
    };
    const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const session = () => activeSession || read(STORE.session, null);
    const slug = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    function notify(message, type = "success") {
        let host = document.getElementById("app-toast-host");
        if (!host) {
            host = document.createElement("div");
            host.id = "app-toast-host";
            host.className = "toast-container position-fixed top-0 end-0 p-3";
            host.style.zIndex = "2000";
            document.body.appendChild(host);
        }
        const item = document.createElement("div");
        item.className = `alert alert-${type} shadow mb-2`;
        item.setAttribute("role", "status");
        item.textContent = message;
        host.appendChild(item);
        setTimeout(() => item.remove(), 3500);
    }

    async function passwordHash(password, salt) {
        const bytes = new TextEncoder().encode(`${salt}:${password}`);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    }

    async function setupSupabase() {
        try {
            const config = await import("./supabase-config.js");
            if (!config.SUPABASE_URL || config.SUPABASE_URL.includes("YOUR_PROJECT")) return;
            const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
            supabaseClient = createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
                auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
            });
            const { data } = await supabaseClient.auth.getSession();
            if (data.session?.user) activeSession = {
                id: data.session.user.id,
                email: data.session.user.email,
                name: data.session.user.user_metadata?.name || data.session.user.email.split("@")[0]
            };
            supabaseClient.auth.onAuthStateChange((_event, next) => {
                activeSession = next?.user ? { id: next.user.id, email: next.user.email, name: next.user.user_metadata?.name || next.user.email.split("@")[0] } : null;
            });
        } catch (error) {
            console.warn("Supabase is not configured; using local demo storage.", error);
        }
    }

    function removeTemplateIdentity() {
        // Remove people and contact details inherited from the original template.
        document.querySelectorAll("a[href='team.html'], a[href='testimonial.html']").forEach(link => link.remove());
        document.querySelectorAll(".nav-item.dropdown").forEach(dropdown => {
            if (!dropdown.querySelector(".dropdown-menu a")) dropdown.remove();
        });
        document.querySelectorAll("img[src*='team-'], img[src*='testimonial-']").forEach(image => {
            const personCard = image.closest(".team-item, .testimonial-item");
            if (personCard) personCard.remove(); else image.remove();
        });
        document.querySelectorAll(".footer .col-lg-4, .footer .col-lg-3, .footer .col-md-6").forEach(column => {
            const heading = column.querySelector("h4")?.textContent.trim().toLowerCase();
            if (heading === "contact") column.remove();
        });
        document.querySelectorAll("a.btn-social").forEach(link => link.remove());
        if (["team.html", "testimonial.html"].includes(location.pathname.split("/").pop().toLowerCase())) {
            location.replace("index.html");
        }
    }

    function setupNavigation() {
        const nav = document.querySelector(".navbar-nav");
        if (!nav || nav.querySelector("[data-app-nav]")) return;
        const user = session();
        const marker = document.createElement("div");
        marker.dataset.appNav = "true";
        marker.className = "d-lg-flex align-items-lg-center";
        marker.innerHTML = user
            ? `<a href="my-courses.html" class="nav-item nav-link"><i class="fa fa-book me-1"></i>My Learning</a>
               <button type="button" class="nav-link btn btn-link text-start" data-logout title="Sign out"><i class="fa fa-user me-1"></i>${escapeHtml(user.name)}</button>`
            : `<a href="login.html" class="nav-item nav-link"><i class="fa fa-user me-1"></i>Login</a>`;
        const oldLogin = Array.from(nav.querySelectorAll("a[href='login.html']")).pop();
        if (oldLogin) oldLogin.remove();
        nav.appendChild(marker);
        marker.querySelector("[data-logout]")?.addEventListener("click", () => {
            localStorage.removeItem(STORE.session);
            if (supabaseClient) supabaseClient.auth.signOut();
            notify("You have signed out.", "info");
            setTimeout(() => location.assign("index.html"), 400);
        });
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
    }

    function setupAuth() {
        const page = location.pathname.split("/").pop().toLowerCase();
        if (page === "signup.html") {
            const form = document.querySelector("form.shadow");
            if (!form) return;
            form.querySelectorAll("input").forEach(input => input.required = true);
            form.addEventListener("submit", async event => {
                event.preventDefault();
                if (!form.reportValidity()) return;
                const name = form.querySelector("#username").value.trim();
                const email = form.querySelector("#email").value.trim().toLowerCase();
                const password = form.querySelector("#password").value;
                if (password.length < 8) return notify("Password must contain at least 8 characters.", "danger");
                if (supabaseClient) {
                    const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { name } } });
                    if (error) return notify(error.message, "danger");
                    if (data.session) activeSession = { id: data.user.id, name, email };
                    notify(data.session ? "Account created successfully." : "Check your email to confirm the account.");
                    return setTimeout(() => location.assign(data.session ? "my-courses.html" : "login.html"), 700);
                }
                const users = read(STORE.users, []);
                if (users.some(user => user.email === email)) return notify("An account with this email already exists.", "warning");
                const salt = crypto.randomUUID();
                users.push({ name, email, salt, passwordHash: await passwordHash(password, salt), createdAt: new Date().toISOString() });
                write(STORE.users, users);
                write(STORE.session, { name, email });
                notify("Account created successfully.");
                setTimeout(() => location.assign("my-courses.html"), 500);
            });
        }
        if (page === "login.html") {
            const form = document.querySelector("form.shadow");
            if (!form) return;
            form.querySelectorAll("input").forEach(input => input.required = true);
            form.addEventListener("submit", async event => {
                event.preventDefault();
                if (!form.reportValidity()) return;
                const email = form.querySelector("#email").value.trim().toLowerCase();
                const password = form.querySelector("#password").value;
                if (supabaseClient) {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) return notify("Incorrect email or password.", "danger");
                    activeSession = { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || data.user.email.split("@")[0] };
                    notify("Welcome back!");
                    const next = new URLSearchParams(location.search).get("next") || "my-courses.html";
                    return setTimeout(() => location.assign(next), 400);
                }
                const user = read(STORE.users, []).find(item => item.email === email);
                if (!user || await passwordHash(password, user.salt) !== user.passwordHash) {
                    return notify("Incorrect email or password.", "danger");
                }
                write(STORE.session, { name: user.name, email: user.email });
                notify("Welcome back!");
                const next = new URLSearchParams(location.search).get("next") || "my-courses.html";
                setTimeout(() => location.assign(next), 400);
            });
            const forgot = form.querySelector("a[href='#']");
            if (forgot) forgot.addEventListener("click", event => {
                event.preventDefault();
                const email = form.querySelector("#email").value.trim().toLowerCase();
                if (!supabaseClient) return notify("Enter your account email. Password reset is available after Supabase setup.", "info");
                if (!email) return notify("Enter your email first.", "warning");
                supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: new URL("login.html", location.href).href })
                    .then(({ error }) => notify(error ? error.message : "Password reset email sent.", error ? "danger" : "success"));
            });
        }
    }

    function courseFromCard(card) {
        const title = card.querySelector("h5")?.textContent.trim().replace(/\s+/g, " ") || "Course";
        return { id: slug(title), title, image: card.querySelector("img")?.getAttribute("src") || "img/course-1.jpg" };
    }

    function setupCourses() {
        document.querySelectorAll(".course-item").forEach(card => {
            const course = courseFromCard(card);
            const enroll = Array.from(card.querySelectorAll("a")).find(link => /enroll/i.test(link.textContent));
            if (!enroll) return;
            enroll.href = `single.html?course=${encodeURIComponent(course.id)}`;
            enroll.addEventListener("click", event => {
                event.preventDefault();
                enrollCourse(course);
            });
        });
        if (location.pathname.endsWith("single.html")) {
            const button = Array.from(document.querySelectorAll("a")).find(link => /enroll now/i.test(link.textContent));
            button?.addEventListener("click", event => {
                event.preventDefault();
                enrollCourse({ id: new URLSearchParams(location.search).get("course") || "html-course-for-beginners", title: document.querySelector("h1")?.textContent.trim() || "HTML Course for Beginners", image: document.querySelector(".image img")?.getAttribute("src") || "img/course-1.jpg" });
            });
        }
    }

    async function enrollCourse(course) {
        const user = session();
        if (!user) {
            notify("Please log in before enrolling.", "warning");
            return setTimeout(() => location.assign(`login.html?next=${encodeURIComponent("courses.html")}`), 700);
        }
        if (supabaseClient) {
            const { error } = await supabaseClient.from("enrollments").upsert({ user_id: user.id, course_id: course.id, course_title: course.title, course_image: course.image }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
            if (error) return notify(error.message, "danger");
            notify("Course added to My Learning.");
            return setTimeout(() => location.assign("my-courses.html"), 500);
        }
        const all = read(STORE.enrollments, {});
        const mine = all[user.email] || [];
        if (!mine.some(item => item.id === course.id)) mine.push({ ...course, progress: 0, enrolledAt: new Date().toISOString() });
        all[user.email] = mine;
        write(STORE.enrollments, all);
        notify("Course added to My Learning.");
        setTimeout(() => location.assign("my-courses.html"), 500);
    }

    function setupCourseSearch() {
        if (!location.pathname.endsWith("courses.html")) return;
        const cards = Array.from(document.querySelectorAll(".course-item"));
        if (!cards.length) return;
        const firstRow = cards[0].closest(".row");
        const search = document.createElement("div");
        search.className = "row justify-content-center mb-4";
        search.innerHTML = `<div class="col-lg-7"><label for="course-search" class="visually-hidden">Search courses</label><div class="input-group shadow-sm"><span class="input-group-text bg-white"><i class="fa fa-search"></i></span><input id="course-search" class="form-control form-control-lg" type="search" placeholder="Search courses by title"><span id="course-count" class="input-group-text bg-white">${cards.length} courses</span></div></div>`;
        firstRow.parentElement.insertBefore(search, firstRow);
        const input = search.querySelector("input");
        const count = search.querySelector("#course-count");
        const preset = new URLSearchParams(location.search).get("q") || "";
        input.value = preset;
        const filter = () => {
            const query = input.value.trim().toLowerCase();
            let visible = 0;
            cards.forEach(card => {
                const show = card.textContent.toLowerCase().includes(query);
                card.closest(".col-lg-3").classList.toggle("d-none", !show);
                if (show) visible++;
            });
            count.textContent = `${visible} course${visible === 1 ? "" : "s"}`;
        };
        input.addEventListener("input", filter);
        filter();
    }

    async function renderMyCourses() {
        const grid = document.getElementById("my-courses-grid");
        if (!grid) return;
        const user = session();
        if (!user) return location.replace("login.html?next=my-courses.html");
        document.getElementById("learner-name").textContent = user.name;
        let mine;
        if (supabaseClient) {
            const { data, error } = await supabaseClient.from("enrollments").select("course_id,course_title,course_image,progress,enrolled_at").order("enrolled_at", { ascending: false });
            if (error) { notify(error.message, "danger"); return; }
            mine = data.map(item => ({ id: item.course_id, title: item.course_title, image: item.course_image, progress: item.progress, enrolledAt: item.enrolled_at }));
        } else mine = read(STORE.enrollments, {})[user.email] || [];
        if (!mine.length) {
            grid.innerHTML = `<div class="col-12 text-center py-5"><i class="fa fa-book-open fa-3x text-primary mb-3"></i><h3>No courses yet</h3><p>Choose a course and start learning.</p><a href="courses.html" class="btn btn-primary px-4">Explore courses</a></div>`;
            return;
        }
        grid.innerHTML = mine.map(course => `<div class="col-lg-4 col-md-6"><article class="card h-100 shadow-sm border-0"><img src="${escapeHtml(course.image)}" class="card-img-top" alt=""><div class="card-body"><h5>${escapeHtml(course.title)}</h5><div class="progress my-3" style="height:10px"><div class="progress-bar" style="width:${course.progress}%"></div></div><p class="small text-muted">${course.progress}% complete</p><button class="btn btn-primary" data-progress="${escapeHtml(course.id)}">${course.progress ? "Continue learning" : "Start course"}</button></div></article></div>`).join("");
        grid.querySelectorAll("[data-progress]").forEach(button => button.addEventListener("click", async () => {
            if (supabaseClient) {
                const card = mine.find(item => item.id === button.dataset.progress);
                const nextProgress = Math.min(100, card.progress + 25);
                const { error } = await supabaseClient.from("enrollments").update({ progress: nextProgress }).eq("course_id", card.id);
                if (error) return notify(error.message, "danger");
                notify(nextProgress === 100 ? "Course completed — congratulations!" : "Progress saved.");
                return renderMyCourses();
            }
            const all = read(STORE.enrollments, {});
            const target = all[user.email].find(item => item.id === button.dataset.progress);
            target.progress = Math.min(100, target.progress + 25);
            write(STORE.enrollments, all);
            notify(target.progress === 100 ? "Course completed — congratulations!" : "Progress saved.");
            renderMyCourses();
        }));
    }

    function setupForms() {
        if (location.pathname.endsWith("contact.html")) {
            const form = Array.from(document.forms).find(item => item.querySelector("#message"));
            const sendMessage = event => {
                event?.preventDefault();
                if (!form.reportValidity()) return;
                const entry = { name: form.querySelector("#name").value.trim(), email: form.querySelector("#email").value.trim(), subject: form.querySelector("#subject").value.trim(), message: form.querySelector("#message").value.trim(), createdAt: new Date().toISOString() };
                const messages = read(STORE.messages, []); messages.push(entry); write(STORE.messages, messages);
                if (supabaseClient) {
                    const { createdAt: _createdAt, ...remoteEntry } = entry;
                    supabaseClient.from("contact_messages").insert(remoteEntry).then(({ error }) => {
                        if (error) return notify(error.message, "danger");
                        form.reset(); notify("Message sent successfully.");
                    });
                } else {
                    form.reset();
                    notify("Message saved on this device. Connect Supabase to receive it online.");
                }
            };
            form?.addEventListener("submit", sendMessage);
            form?.querySelector("button[type='submit'] a")?.addEventListener("click", sendMessage);
        }
        document.querySelectorAll("form").forEach(form => {
            const button = Array.from(form.querySelectorAll("button, a")).find(item => /subscribe/i.test(item.textContent));
            const email = form.querySelector("input[type='email']");
            if (!button || !email) return;
            const subscribe = event => {
                event.preventDefault();
                if (!email.value || !email.checkValidity()) return email.reportValidity();
                const list = read(STORE.subscribers, []);
                if (!list.includes(email.value.toLowerCase())) list.push(email.value.toLowerCase());
                write(STORE.subscribers, list);
                if (supabaseClient) {
                    supabaseClient.from("newsletter_subscribers").upsert({ email: email.value.toLowerCase() }, { onConflict: "email", ignoreDuplicates: true })
                        .then(({ error }) => { if (error) return notify(error.message, "danger"); form.reset(); notify("Thanks for subscribing!"); });
                } else { form.reset(); notify("Thanks for subscribing!"); }
            };
            form.addEventListener("submit", subscribe);
            button.addEventListener("click", subscribe);
        });
        if (location.pathname.endsWith("instructor.html")) {
            const modal = document.getElementById("exampleModal");
            const form = modal?.querySelector("form");
            const apply = modal?.querySelector(".modal-footer button[type='submit']");
            apply?.addEventListener("click", () => {
                const required = form.querySelectorAll("input:not([type='checkbox']), textarea, select");
                required.forEach(field => field.required = true);
                const consent = form.querySelector("input[type='checkbox']");
                if (consent) consent.required = true;
                if (!form.reportValidity()) return;
                const data = Object.fromEntries(Array.from(required).map(field => [field.id || field.name, field.value]));
                const list = read(STORE.applications, []); list.push({ ...data, createdAt: new Date().toISOString() }); write(STORE.applications, list);
                if (supabaseClient) {
                    const selects = form.querySelectorAll("select");
                    supabaseClient.from("instructor_applications").insert({ first_name: data.f_name, last_name: data.l_name, email: data.email, phone: data.phone, degree: selects[0]?.value, subject: selects[1]?.value, address: data.address })
                        .then(({ error }) => { if (error) return notify(error.message, "danger"); form.reset(); bootstrap.Modal.getOrCreateInstance(modal).hide(); notify("Application submitted successfully."); });
                } else { form.reset(); bootstrap.Modal.getOrCreateInstance(modal).hide(); notify("Application submitted successfully."); }
            });
        }
    }

    function setupCategoryLinks() {
        document.querySelectorAll("a[href='#']").forEach(link => {
            if (/^(microsoft excel|aws|python|java|web design|web development|mysql|ui\/ux design)$/i.test(link.textContent.trim())) {
                link.href = `courses.html?q=${encodeURIComponent(link.textContent.trim())}`;
            }
        });
    }

    document.addEventListener("DOMContentLoaded", async () => {
        removeTemplateIdentity();
        await setupSupabase();
        setupNavigation();
        setupAuth();
        setupCourses();
        setupCourseSearch();
        renderMyCourses();
        setupForms();
        setupCategoryLinks();
    });
})();





