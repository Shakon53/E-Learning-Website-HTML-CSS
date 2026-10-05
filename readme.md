# E-Learning Website using HTML5, CSS3, Bootstrap5 and JavaScript 

![E-Learning Website](preview.jpg)

The project involves the creation of an e-learning website using HTML, CSS, Bootstrap 5, and JavaScript. The website aims to provide a user-friendly and responsive platform for learners to access educational content. 


## Introduction

Secret Coder is an e-learning website designed to provide a user-friendly and responsive platform for learners to access educational content. The project incorporates HTML, CSS, Bootstrap 5, and JavaScript to create an interactive and visually appealing learning experience.

## Features

- 12 introductory courses with 36 bilingual lessons, practical assignments and knowledge checks.
- Ordered lesson completion, server-checked final tests (80% to pass), and named certificates with public verification links.
- Certificates can be printed or saved as PDF through the browser print dialog.

### Learning backend

Apply the committed Supabase migrations with `supabase db push`. Course content is authored in `tools/build-learning.cjs`; run `node tools/build-learning.cjs` to regenerate the public content and its seed migration before deployment. Do not change a live course version without planning how existing completion records will be migrated.

The browser cannot update progress or issue certificates directly. Supabase RPC functions check authentication, enrollment, lesson order and answers. Certificates are issued only after every lesson and an 80% final test. Earlier click-based progress is reset while enrollments are retained. Practical assignments are self-confirmed; certificates describe introductory course completion and are not accredited qualifications.

- English and Russian interface with a language selector on every page. The choice is saved in the browser; Russian is selected initially for browsers using Russian.
- Interface translations are maintained in `js/i18n.js`. Course identifiers and form values are kept unchanged across languages.

- Responsive design using Bootstrap 5.
- Structured course catalog with detailed descriptions.
- Interactive lessons.
- User can register and login.
- User authentication for personalized learning experiences.
- Instructor application form.
- User can also contact us.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following prerequisites:

- Web browser (e.g., Chrome, Firefox, Safari)
- Text editor (e.g., Visual Studio Code, Sublime Text)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/keerti-1924/E-Learning-Website-HTML-CSS.git

2. Open the project in your preferred text editor.
3. Launch the `index.html` file in a web browser.

## Technologies Used

- HTML
- CSS
- Bootstrap 5
- JavaScript

📱 Moreover, I've ensured that the website is fully responsive on all screens, making it accessible and user-friendly across various devices. 📱💡

## Contributing 

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](/issues).

## Show your support 

Give a ⭐️ if you like this project!


## License

This project is **free to use** and does not contains any license.
