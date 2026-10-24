// src/pages/landing-page/classicContent.js
// Shared by the Classic template and its editor (Super admin → Websites):
//   • CLASSIC_FEATURE_ICONS — icons that "Why choose us" items can use
//   • classicSample(name, lang) — example text + photos to start a center's website,
//     in English ('en') or Vietnamese ('vi').
// The sample photos are free Unsplash images; centers should replace them with
// their own (the editor uploads photos to our server).

export const CLASSIC_FEATURE_ICONS = ['star', 'users', 'book', 'cap', 'globe', 'award', 'video', 'chat', 'target', 'laptop', 'heart', 'shield', 'calendar', 'clock'];

const photo = (id, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export function classicSample(centerName = 'Our school', lang = 'en') {
  return lang === 'vi' ? vietnameseSample(centerName) : englishSample(centerName);
}

function englishSample(centerName) {
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
    contact: { enabled: true, email: 'hello@yourschool.com', phone: '+1 555 0100', address: '12 Example Street, Your City', hours: 'Mon–Fri 8:00–20:00 · Sat 9:00–14:00' },
    links: { facebook: 'https://facebook.com/yourschool', instagram: 'https://instagram.com/yourschool' },
    seo: {
      title: `${centerName} — English lessons for kids, teens & adults`,
      description: `${centerName}: friendly English classes online and in person. Small groups, qualified teachers and a free placement test.`,
    },
    footer: { about: `${centerName} offers friendly, high-quality English lessons for children, teens and adults — online and in person.` },
    teachers: [
      { name: 'Grace Mensah', title: 'Head of Studies · CELTA', bio: 'Ten years teaching young learners and exam classes.', photo: photo('1573497019940-1c28c88b4f3e', 600) },
      { name: 'James Carter', title: 'IELTS Specialist', bio: 'Former examiner who loves helping students hit their target band.', photo: photo('1500648767791-00dcc994a43e', 600) },
      { name: 'Linh Nguyen', title: 'Kids & Teens Teacher', bio: 'Brings energy, games and patience to every lesson.', photo: photo('1544005313-94ddf0286df2', 600) },
      { name: 'Daniel Okafor', title: 'Business English Coach', bio: 'Helps professionals communicate clearly at work.', photo: photo('1519085360753-af0119f7cbe7', 600) },
    ],
  };
}

/**
 * Text and photos in the sample that are clearly "example" — long sentences, the
 * sample photos and the yourschool / Example Street (truongcuaban / Đường Ví Dụ)
 * placeholders. Short generic words ("Learn more", "About us") are left out so they
 * never stay flagged.
 */
export const isExampleText = (v) => typeof v === 'string' && (v.length >= 25 || /unsplash\.com|yourschool|example street|truongcuaban|đường ví dụ/i.test(v));

/** Every example string in the sample (both languages), grouped by top-level section key. */
export function classicExampleStrings(centerName) {
  const bySection = {};
  // every sample number ("1,200+", "98%") is an example, however short
  const walk = (v, set, all) => {
    if (Array.isArray(v)) v.forEach(x => walk(x, set, all));
    else if (v && typeof v === 'object') Object.values(v).forEach(x => walk(x, set, all));
    else if (isExampleText(v) || (all && typeof v === 'string' && v)) set.add(v);
  };
  for (const lang of ['en', 'vi']) {
    for (const [k, v] of Object.entries(classicSample(centerName, lang))) walk(v, (bySection[k] = bySection[k] || new Set()), k === 'stats');
  }
  return bySection;
}

function vietnameseSample(centerName) {
  return {
    topBar: { enabled: true, text: 'Đang tuyển sinh khóa mới — đăng ký kiểm tra trình độ miễn phí ngay hôm nay.' },
    hero: {
      badge: 'Tiếng Anh cho trẻ em, thiếu niên & người lớn',
      headline: 'Tự tin giao tiếp tiếng Anh ngay từ buổi học đầu tiên',
      subheadline: `${centerName} giúp học viên mọi lứa tuổi sử dụng tiếng Anh thực tế với giáo viên giàu kinh nghiệm, lớp học nhỏ và hình thức học trực tuyến hoặc tại trung tâm.`,
      ctaText: 'Học thử miễn phí', ctaUrl: '/student/login',
      secondaryCtaText: 'Xem khóa học', secondaryCtaUrl: '#programs',
      image: photo('1524178232363-1fb2b075b655', 1900),
    },
    stats: {
      enabled: true,
      items: [
        { value: '1.200+', label: 'Học viên đã theo học' },
        { value: '25+', label: 'Giáo viên chuyên môn' },
        { value: '98%', label: 'Phụ huynh hài lòng' },
        { value: '12', label: 'Năm giảng dạy' },
      ],
    },
    about: {
      enabled: true,
      subtitle: 'Về chúng tôi',
      title: 'Ngôi trường thân thiện, nơi mỗi học viên đều được quan tâm',
      body: `Hơn mười năm qua, ${centerName} đã đồng hành cùng trẻ em, thiếu niên và người lớn chinh phục mục tiêu tiếng Anh. Bài học kết hợp lộ trình rõ ràng với giao tiếp, trò chơi và thực hành thực tế, để học viên yêu thích việc học và tiến bộ mỗi tuần.`,
      image: photo('1509062522246-3755977927d7', 1000),
      image2: photo('1522202176988-66273c2fd55f', 700),
      badgeValue: '12+', badgeLabel: 'Năm kinh nghiệm',
      points: ['Giáo viên có chứng chỉ, giàu kinh nghiệm', 'Lớp nhóm nhỏ & học kèm 1 thầy 1 trò', 'Học trực tuyến và tại trung tâm', 'Báo cáo tiến bộ định kỳ'],
    },
    programs: {
      enabled: true,
      title: 'Khóa học cho mọi độ tuổi và mục tiêu',
      subtitle: 'Chọn khóa học phù hợp — chúng tôi sẽ xếp lớp đúng trình độ sau buổi kiểm tra miễn phí.',
      items: [
        { image: photo('1546410531-bb4caa6b424d', 800), level: '5–12 tuổi', title: 'Tiếng Anh Thiếu nhi', text: 'Bài học vui nhộn với bài hát, câu chuyện và trò chơi giúp bé mở rộng vốn từ, tự tin nói và làm quen với đọc.', duration: '2 buổi × 45 phút / tuần', price: 'Từ 1.500.000đ / tháng', ctaText: 'Tìm hiểu thêm', ctaUrl: '#contact' },
        { image: photo('1427504494785-3a9ca7044f45', 800), level: '13–17 tuổi', title: 'Tiếng Anh Thiếu niên & Luyện thi', text: 'Ngữ pháp, viết và nói kết hợp luyện thi các kỳ thi ở trường và chứng chỉ Cambridge.', duration: '3 buổi × 60 phút / tuần', price: 'Từ 2.000.000đ / tháng', ctaText: 'Tìm hiểu thêm', ctaUrl: '#contact' },
        { image: photo('1517245386807-bb43f82c33c4', 800), level: 'Người lớn', title: 'Tiếng Anh Giao tiếp & Thương mại', text: 'Giao tiếp lưu loát cho công việc và du lịch: họp, viết email, thuyết trình và trò chuyện hằng ngày.', duration: 'Lịch học linh hoạt', price: 'Từ 2.300.000đ / tháng', ctaText: 'Tìm hiểu thêm', ctaUrl: '#contact' },
        { image: photo('1456513080510-7bf3a84b82f8', 800), level: 'Luyện thi', title: 'Luyện thi IELTS', text: 'Học chiến lược làm bài và thi thử đầy đủ cả bốn kỹ năng, có nhận xét chi tiết.', duration: 'Khóa 8 tuần', price: 'Từ 5.900.000đ', ctaText: 'Tìm hiểu thêm', ctaUrl: '#contact' },
        { image: photo('1588072432836-e10032774350', 800), level: 'Trực tuyến', title: 'Lớp học trực tuyến', text: 'Học tương tác tại nhà với cùng giáo viên, giáo trình và theo dõi tiến bộ như lớp tại trung tâm.', duration: 'Học ở bất cứ đâu', price: 'Từ 1.300.000đ / tháng', ctaText: 'Tìm hiểu thêm', ctaUrl: '#contact' },
        { image: photo('1544717305-2782549b5136', 800), level: '1 kèm 1', title: 'Học kèm riêng', text: 'Lộ trình cá nhân theo mục tiêu, tốc độ và lịch của bạn với một giáo viên riêng.', duration: 'Buổi 60 phút', price: 'Từ 600.000đ / buổi', ctaText: 'Tìm hiểu thêm', ctaUrl: '#contact' },
      ],
    },
    features: {
      enabled: true,
      title: 'Vì sao phụ huynh và học viên chọn chúng tôi',
      subtitle: 'Mọi thứ được thiết kế để việc học hiệu quả, thú vị và dễ theo dõi.',
      items: [
        { icon: 'award', title: 'Giáo viên chuyên môn', text: 'Giáo viên giàu kinh nghiệm, có chứng chỉ, giúp mỗi bài học rõ ràng và hấp dẫn.' },
        { icon: 'users', title: 'Lớp học nhỏ', text: 'Tối đa 8 học viên mỗi lớp, ai cũng được nói và được quan tâm.' },
        { icon: 'calendar', title: 'Lịch học linh hoạt', text: 'Lớp sáng, tối và cuối tuần — trực tuyến hoặc tại trung tâm.' },
        { icon: 'target', title: 'Tiến bộ rõ ràng', text: 'Kiểm tra trình độ và báo cáo giúp học viên và phụ huynh thấy rõ sự tiến bộ.' },
        { icon: 'laptop', title: 'Học mọi lúc mọi nơi', text: 'Bài tập, bài kiểm tra và video buổi học trên một nền tảng trực tuyến dễ dùng.' },
        { icon: 'heart', title: 'Môi trường thân thiện', text: 'Nơi học tập ấm áp, an toàn — sự tự tin lớn lên cùng tiếng Anh.' },
      ],
    },
    testimonials: {
      enabled: true,
      title: 'Học viên và phụ huynh nói gì về chúng tôi',
      items: [
        { name: 'Chị Lan Anh', role: 'Phụ huynh bé 9 tuổi', photo: photo('1494790108377-be9c29b29330', 200), quote: 'Con tôi trước đây rất ngại nói tiếng Anh. Sau một khóa, bé đã trả lời trọn câu và luôn mong đến giờ học.', rating: 5 },
        { name: 'Minh Tuấn', role: 'Học viên IELTS', photo: photo('1507003211169-0a1dd7228f2d', 200), quote: 'Các bài thi thử và nhận xét của thầy cô đúng là điều tôi cần. Tôi tăng từ 6.0 lên 7.5 chỉ trong hai tháng.', rating: 5 },
        { name: 'Thu Trang', role: 'Tiếng Anh Thương mại', photo: photo('1438761681033-6461ffad8d80', 200), quote: 'Lịch học phù hợp với công việc và tập trung vào những gì tôi thật sự dùng: họp và email. Tôi tự tin hơn hẳn ở công ty.', rating: 5 },
      ],
    },
    gallery: {
      enabled: true,
      title: 'Hoạt động tại trường',
      items: [
        { image: photo('1503676260728-1c00da094a0b', 1000), caption: 'Cùng nhau học tập' },
        { image: photo('1580582932707-520aed937b7b', 700), caption: 'Trường của chúng tôi' },
        { image: photo('1513258496099-48168024aec0', 700), caption: 'Giờ tự học' },
        { image: photo('1571260899304-425eee4c7efc', 700), caption: 'Dự án nhóm' },
        { image: photo('1497633762265-9d179a990aa6', 700), caption: 'Góc đọc sách' },
      ],
    },
    cta: {
      enabled: true,
      title: 'Bắt đầu hành trình tiếng Anh ngay tháng này',
      text: 'Đăng ký kiểm tra trình độ và học thử miễn phí — chúng tôi sẽ tư vấn lớp học phù hợp nhất cho bạn.',
      buttonText: 'Học thử miễn phí', buttonUrl: '/student/login',
      image: photo('1531545514256-b1400bc00f31', 1800),
    },
    faq: {
      enabled: true,
      title: 'Câu hỏi thường gặp',
      subtitle: 'Chưa tìm thấy câu trả lời? Hãy liên hệ, chúng tôi luôn sẵn lòng hỗ trợ.',
      items: [
        { q: 'Làm sao biết nên học lớp trình độ nào?', a: 'Mỗi học viên mới đều được kiểm tra trình độ miễn phí. Sau đó chúng tôi tư vấn lớp phù hợp với trình độ và mục tiêu.' },
        { q: 'Trung tâm có lớp học trực tuyến không?', a: 'Có. Tất cả khóa học đều có lớp trực tuyến với cùng giáo viên và giáo trình như lớp tại trung tâm.' },
        { q: 'Mỗi lớp có bao nhiêu học viên?', a: 'Lớp nhóm tối đa 8 học viên. Ngoài ra còn có lớp học kèm 1 thầy 1 trò.' },
        { q: 'Phụ huynh theo dõi tiến bộ của con như thế nào?', a: 'Phụ huynh nhận báo cáo sau mỗi buổi học và cập nhật tiến bộ định kỳ, đồng thời xem kết quả bài tập và bài kiểm tra trực tuyến.' },
        { q: 'Có được học thử trước khi đóng học phí không?', a: 'Tất nhiên — hãy đăng ký một buổi học thử miễn phí và gặp giáo viên trước khi quyết định.' },
      ],
    },
    contact: { enabled: true, email: 'xinchao@truongcuaban.vn', phone: '+84 90 000 0000', address: '12 Đường Ví Dụ, Quận 1, TP. Hồ Chí Minh', hours: 'Thứ 2–Thứ 6 8:00–20:00 · Thứ 7 9:00–14:00' },
    links: { facebook: 'https://facebook.com/truongcuaban', instagram: 'https://instagram.com/truongcuaban' },
    seo: {
      title: `${centerName} — Tiếng Anh cho trẻ em, thiếu niên & người lớn`,
      description: `${centerName}: lớp tiếng Anh thân thiện, học trực tuyến hoặc tại trung tâm. Lớp nhỏ, giáo viên chuyên môn và kiểm tra trình độ miễn phí.`,
    },
    footer: { about: `${centerName} mang đến các lớp tiếng Anh chất lượng, thân thiện cho trẻ em, thiếu niên và người lớn — trực tuyến và tại trung tâm.` },
    teachers: [
      { name: 'Nguyễn Thu Hà', title: 'Trưởng bộ môn · CELTA', bio: 'Mười năm giảng dạy thiếu nhi và các lớp luyện thi.', photo: photo('1573497019940-1c28c88b4f3e', 600) },
      { name: 'James Carter', title: 'Chuyên gia IELTS', bio: 'Cựu giám khảo, luôn giúp học viên đạt band điểm mục tiêu.', photo: photo('1500648767791-00dcc994a43e', 600) },
      { name: 'Trần Minh Anh', title: 'Giáo viên Thiếu nhi & Thiếu niên', bio: 'Mang năng lượng, trò chơi và sự kiên nhẫn vào mỗi buổi học.', photo: photo('1544005313-94ddf0286df2', 600) },
      { name: 'Daniel Okafor', title: 'Giáo viên Tiếng Anh Thương mại', bio: 'Giúp người đi làm giao tiếp rõ ràng, tự tin trong công việc.', photo: photo('1519085360753-af0119f7cbe7', 600) },
    ],
  };
}
