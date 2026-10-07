// src/pages/landing-page/classicContent.js
// Shared by the Classic template and its editor (Super admin → Websites):
//   • CLASSIC_FEATURE_ICONS — icons that "Why choose us" items can use
//   • classicSample(name)   — example text + photos to start a center's website.
// The sample photos are free Unsplash images; centers should replace them with
// their own (the editor uploads photos to our server).

export const CLASSIC_FEATURE_ICONS = ['star', 'users', 'book', 'cap', 'globe', 'award', 'video', 'chat', 'target', 'laptop', 'heart', 'shield', 'calendar', 'clock'];

const photo = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export function classicSample(centerName = 'Our school') {
  return {
    topBar: { enabled: true, text: 'Admissions are open for the new term — book a free placement test today.' },
    hero: {
      badge: 'English for kids, teens & adults',
      headline: 'Speak English with confidence — from your very first lesson',
      subheadline: `${centerName} helps learners of every age build real-world English with experienced teachers, small classes and lessons online or in person.`,
      ctaText: 'Book a free trial', ctaUrl: '/student/login',
      secondaryCtaText: 'Explore programs', secondaryCtaUrl: '#programs',
      image: photo('1524178232363-1fb2b075b655', 1900),
    },
    stats: {
      enabled: true,
      items: [
        { value: '1,200+', label: 'Students taught' },
        { value: '25+', label: 'Qualified teachers' },
        { value: '98%', label: 'Parent satisfaction' },
        { value: '12', label: 'Years of teaching' },
      ],
    },
    about: {
      enabled: true,
      subtitle: 'About us',
      title: 'A friendly school where every learner is known by name',
      body: `For over a decade, ${centerName} has helped children, teenagers and adults reach their English goals. Our lessons combine clear structure with conversation, games and real-life practice, so students enjoy learning and see progress every week.`,
      image: photo('1509062522246-3755977927d7', 1000),
      image2: photo('1522202176988-66273c2fd55f', 700),
      badgeValue: '12+', badgeLabel: 'Years of experience',
      points: ['Certified, experienced teachers', 'Small groups & 1-on-1 lessons', 'Online and in-person classes', 'Regular progress reports'],
    },
    programs: {
      enabled: true,
      title: 'Courses for every age and goal',
      subtitle: 'Choose a program and we will place you at the right level after a free assessment.',
      items: [
        { image: photo('1546410531-bb4caa6b424d', 800), level: 'Ages 5–12', title: 'Kids English', text: 'Playful lessons with songs, stories and games that build vocabulary, speaking and early reading.', duration: '2 × 45 min / week', price: 'From $60 / month', ctaText: 'Learn more', ctaUrl: '#contact' },
        { image: photo('1427504494785-3a9ca7044f45', 800), level: 'Ages 13–17', title: 'Teen English & Exams', text: 'Grammar, writing and speaking practice with preparation for school tests and Cambridge exams.', duration: '3 × 60 min / week', price: 'From $85 / month', ctaText: 'Learn more', ctaUrl: '#contact' },
        { image: photo('1517245386807-bb43f82c33c4', 800), level: 'Adults', title: 'General & Business English', text: 'Fluency for work and travel: meetings, emails, presentations and everyday conversation.', duration: 'Flexible schedule', price: 'From $95 / month', ctaText: 'Learn more', ctaUrl: '#contact' },
        { image: photo('1456513080510-7bf3a84b82f8', 800), level: 'Exam prep', title: 'IELTS Preparation', text: 'Strategy-focused lessons and full mock tests for all four skills, with detailed feedback.', duration: '8-week course', price: 'From $240', ctaText: 'Learn more', ctaUrl: '#contact' },
        { image: photo('1588072432836-e10032774350', 800), level: 'Online', title: 'Live Online Classes', text: 'Interactive lessons from home with the same teachers, materials and progress tracking.', duration: 'Any time zone', price: 'From $55 / month', ctaText: 'Learn more', ctaUrl: '#contact' },
        { image: photo('1544717305-2782549b5136', 800), level: '1-on-1', title: 'Private Tutoring', text: 'A personal plan built around your goals, pace and schedule with one dedicated teacher.', duration: '60 min sessions', price: 'From $25 / lesson', ctaText: 'Learn more', ctaUrl: '#contact' },
      ],
    },
    features: {
      enabled: true,
      title: 'Why families and professionals choose us',
      subtitle: 'Everything is designed to make learning effective, enjoyable and easy to follow.',
      items: [
        { icon: 'award', title: 'Qualified teachers', text: 'Experienced, certified teachers who make every lesson clear and engaging.' },
        { icon: 'users', title: 'Small classes', text: 'Groups of up to 8 students, so everyone speaks and gets attention.' },
        { icon: 'calendar', title: 'Flexible timetable', text: 'Morning, evening and weekend classes — online or at our school.' },
        { icon: 'target', title: 'Clear progress', text: 'Level checks and reports show students and parents exactly how they improve.' },
        { icon: 'laptop', title: 'Learn anywhere', text: 'Homework, quizzes and class recordings in one easy online platform.' },
        { icon: 'heart', title: 'Caring community', text: 'A warm, safe place to learn where confidence grows along with English.' },
      ],
    },
    testimonials: {
      enabled: true,
      title: 'What our students and parents say',
      items: [
        { name: 'Amara O.', role: 'Parent of a 9-year-old', photo: photo('1494790108377-be9c29b29330', 200), quote: 'My daughter used to be shy about speaking English. After one term she answers in full sentences and actually looks forward to class.', rating: 5 },
        { name: 'Minh T.', role: 'IELTS student', photo: photo('1507003211169-0a1dd7228f2d', 200), quote: 'The mock tests and feedback were exactly what I needed. I improved from band 6.0 to 7.5 in two months.', rating: 5 },
        { name: 'Sofia R.', role: 'Business English', photo: photo('1438761681033-6461ffad8d80', 200), quote: 'Lessons fit around my work and focus on what I really use: meetings and emails. My confidence at work has grown so much.', rating: 5 },
      ],
    },
    gallery: {
      enabled: true,
      title: 'Life at our school',
      items: [
        { image: photo('1503676260728-1c00da094a0b', 1000), caption: 'Learning together' },
        { image: photo('1580582932707-520aed937b7b', 700), caption: 'Our school' },
        { image: photo('1513258496099-48168024aec0', 700), caption: 'Study time' },
        { image: photo('1571260899304-425eee4c7efc', 700), caption: 'Group project' },
        { image: photo('1497633762265-9d179a990aa6', 700), caption: 'Reading corner' },
      ],
    },
    cta: {
      enabled: true,
      title: 'Start your English journey this month',
      text: 'Book a free placement test and trial lesson — we will recommend the right class for you.',
      buttonText: 'Book a free trial', buttonUrl: '/student/login',
      image: photo('1531545514256-b1400bc00f31', 1800),
    },
    faq: {
      enabled: true,
      title: 'Frequently asked questions',
      subtitle: "Can't find your answer? Contact us and we will be happy to help.",
      items: [
        { q: 'How do I know which level to join?', a: 'Every new student takes a free placement test. We then recommend the class that matches their level and goals.' },
        { q: 'Do you offer online classes?', a: 'Yes. All our programs are available live online with the same teachers and materials as in-person classes.' },
        { q: 'How big are the classes?', a: 'Group classes have a maximum of 8 students. Private 1-on-1 lessons are also available.' },
        { q: 'How will I see my child’s progress?', a: 'Parents receive class reports after lessons and regular progress updates, and can follow homework and quiz results online.' },
        { q: 'Can I try a lesson before paying?', a: 'Of course — book a free trial lesson and meet your teacher before you decide.' },
      ],
    },
    contact: { enabled: true, hours: 'Mon–Fri 8:00–20:00 · Sat 9:00–14:00' },
    footer: { about: `${centerName} offers friendly, high-quality English lessons for children, teens and adults — online and in person.` },
    teachers: [
      { name: 'Grace Mensah', title: 'Head of Studies · CELTA', bio: 'Ten years teaching young learners and exam classes.', photo: photo('1573497019940-1c28c88b4f3e', 600) },
      { name: 'James Carter', title: 'IELTS Specialist', bio: 'Former examiner who loves helping students hit their target band.', photo: photo('1500648767791-00dcc994a43e', 600) },
      { name: 'Linh Nguyen', title: 'Kids & Teens Teacher', bio: 'Brings energy, games and patience to every lesson.', photo: photo('1544005313-94ddf0286df2', 600) },
      { name: 'Daniel Okafor', title: 'Business English Coach', bio: 'Helps professionals communicate clearly at work.', photo: photo('1519085360753-af0119f7cbe7', 600) },
    ],
  };
}
