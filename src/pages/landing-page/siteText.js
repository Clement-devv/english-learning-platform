// src/pages/landing-page/siteText.js
// The words built into the website templates (menus, section labels, buttons…) in
// each website language. A center picks its language in Super admin → Websites →
// Design (lp.language); everything the super admin types is shown as typed.
import { createContext, useContext } from 'react';

const en = {
  lang: 'en',
  home: 'Home', about: 'About', programs: 'Programs', teachers: 'Teachers', reviews: 'Reviews', faq: 'FAQ', contact: 'Contact',
  login: 'Login', logIn: 'Log in', menu: 'Menu', mainNav: 'Main',
  student: 'Student', teacher: 'Teacher', parent: 'Parent',
  students: 'Students', teachersPl: 'Teachers', parents: 'Parents',
  studentLogin: 'Student login', teacherLogin: 'Teacher login', parentLogin: 'Parent login',
  hintStudent: 'Join your classes', hintTeacher: 'Manage your lessons', hintParent: "Follow your child's progress",
  adminLogin: 'School admin login', schoolAdmin: 'School admin',
  enroll: 'Enroll now', getStarted: 'Get started', learnMore: 'Learn more',
  heroHeadline: (n) => `Learn English with confidence at ${n}`,
  heroSub: 'Expert teachers, small classes and a clear path from your first words to fluent conversation.',
  rated: (r) => `Rated ${r} out of 5`, outOf5: (n) => `${n} out of 5`, rating: 'rating',
  yearsExp: 'Years of experience',
  aboutUs: 'About us', aboutTitle: 'A school built around every learner',
  ourPrograms: 'Our programs', programsTitle: 'Courses for every goal', programNo: (n) => `No. ${n}`,
  whyUs: 'Why choose us', whyUsShort: 'Why us', featuresTitle: 'Everything you need to succeed',
  ourTeachers: 'Our teachers', teachersTitle: 'Learn from experienced educators', teachersTitleModern: 'The people behind every lesson',
  testimonials: 'Testimonials', testimonialsTitle: 'What our students and parents say', testimonialsTitleModern: 'Loved by students and parents',
  gallery: 'Gallery', galleryTitle: 'Life at our school', photo: 'Photo', photoN: (n) => `Photo ${n}`,
  close: 'Close', prev: 'Previous', next: 'Next',
  enrolOpen: 'Enrolment open',
  faqTitle: 'Frequently asked questions', faqTitleModern: 'Questions, answered', faqSub: "Can't find your answer? We're happy to help.", contactUs: 'Contact us',
  contactTitle: 'Get in touch', contactTitleModern: "Let's talk",
  contactSub: 'Questions about classes, levels or prices? Reach out — we reply quickly.',
  contactSubModern: 'Questions about classes, levels or prices? We reply quickly.',
  visitUs: 'Visit us', callUs: 'Call us', emailUs: 'Email us', openingHours: 'Opening hours', openMaps: 'Open in Google Maps',
  visit: 'Visit', call: 'Call', email: 'Email', hours: 'Hours',
  footerAbout: 'Quality English education for children and adults, online and in class.',
  explore: 'Explore', portals: 'Portals', rights: 'All rights reserved.', poweredBy: 'Powered by Clemify',
  whatWeTeach: 'What we teach',
  soon: 'Website coming soon', soonText: 'Our new website is on the way. Students, parents and teachers can sign in below.',
  staff: 'School staff?', adminShort: 'Admin login', ourSchool: 'Our school',
};

const vi = {
  lang: 'vi',
  home: 'Trang chủ', about: 'Giới thiệu', programs: 'Khóa học', teachers: 'Giáo viên', reviews: 'Đánh giá', faq: 'Hỏi đáp', contact: 'Liên hệ',
  login: 'Đăng nhập', logIn: 'Đăng nhập', menu: 'Menu', mainNav: 'Điều hướng chính',
  student: 'Học viên', teacher: 'Giáo viên', parent: 'Phụ huynh',
  students: 'Học viên', teachersPl: 'Giáo viên', parents: 'Phụ huynh',
  studentLogin: 'Học viên đăng nhập', teacherLogin: 'Giáo viên đăng nhập', parentLogin: 'Phụ huynh đăng nhập',
  hintStudent: 'Vào lớp học của bạn', hintTeacher: 'Quản lý bài giảng', hintParent: 'Theo dõi tiến bộ của con',
  adminLogin: 'Đăng nhập quản trị trường', schoolAdmin: 'Quản trị trường',
  enroll: 'Đăng ký ngay', getStarted: 'Bắt đầu ngay', learnMore: 'Tìm hiểu thêm',
  heroHeadline: (n) => `Tự tin nói tiếng Anh cùng ${n}`,
  heroSub: 'Giáo viên giàu kinh nghiệm, lớp học nhỏ và lộ trình rõ ràng — từ những từ đầu tiên đến giao tiếp lưu loát.',
  rated: (r) => `Đánh giá ${r} trên 5`, outOf5: (n) => `${n} trên 5`, rating: 'đánh giá',
  yearsExp: 'Năm kinh nghiệm',
  aboutUs: 'Về chúng tôi', aboutTitle: 'Ngôi trường lấy người học làm trung tâm',
  ourPrograms: 'Chương trình học', programsTitle: 'Khóa học cho mọi mục tiêu', programNo: (n) => `Khóa ${n}`,
  whyUs: 'Vì sao chọn chúng tôi', whyUsShort: 'Vì sao chọn chúng tôi', featuresTitle: 'Mọi thứ bạn cần để thành công',
  ourTeachers: 'Đội ngũ giáo viên', teachersTitle: 'Học cùng những giáo viên giàu kinh nghiệm', teachersTitleModern: 'Những người đứng sau mỗi bài học',
  testimonials: 'Cảm nhận', testimonialsTitle: 'Học viên và phụ huynh nói gì về chúng tôi', testimonialsTitleModern: 'Được học viên và phụ huynh tin yêu',
  gallery: 'Hình ảnh', galleryTitle: 'Cuộc sống tại trường', photo: 'Ảnh', photoN: (n) => `Ảnh ${n}`,
  close: 'Đóng', prev: 'Ảnh trước', next: 'Ảnh tiếp',
  enrolOpen: 'Đang tuyển sinh',
  faqTitle: 'Câu hỏi thường gặp', faqTitleModern: 'Giải đáp thắc mắc', faqSub: 'Chưa tìm thấy câu trả lời? Chúng tôi luôn sẵn lòng hỗ trợ.', contactUs: 'Liên hệ với chúng tôi',
  contactTitle: 'Liên hệ với chúng tôi', contactTitleModern: 'Trò chuyện cùng chúng tôi',
  contactSub: 'Bạn có câu hỏi về lớp học, trình độ hay học phí? Hãy liên hệ — chúng tôi phản hồi nhanh chóng.',
  contactSubModern: 'Bạn có câu hỏi về lớp học, trình độ hay học phí? Chúng tôi phản hồi nhanh chóng.',
  visitUs: 'Địa chỉ', callUs: 'Gọi cho chúng tôi', emailUs: 'Gửi email', openingHours: 'Giờ làm việc', openMaps: 'Mở Google Maps',
  visit: 'Địa chỉ', call: 'Điện thoại', email: 'Email', hours: 'Giờ làm việc',
  footerAbout: 'Chương trình tiếng Anh chất lượng cho trẻ em và người lớn, học trực tuyến hoặc tại lớp.',
  explore: 'Khám phá', portals: 'Cổng đăng nhập', rights: 'Bảo lưu mọi quyền.', poweredBy: 'Vận hành bởi Clemify',
  whatWeTeach: 'Chúng tôi dạy gì',
  soon: 'Website sắp ra mắt', soonText: 'Website mới của chúng tôi sắp ra mắt. Học viên, phụ huynh và giáo viên có thể đăng nhập bên dưới.',
  staff: 'Nhân viên nhà trường?', adminShort: 'Đăng nhập quản trị', ourSchool: 'Trường của chúng tôi',
};

export const SITE_LANGUAGES = [{ value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' }];
export const siteText = (lang) => (lang === 'vi' ? vi : en);

// Templates provide the website's words once; every section reads them with useSiteText()
export const SiteTextCtx = createContext(en);
export const useSiteText = () => useContext(SiteTextCtx);

// Body fonts in the editor that have no Vietnamese accents (ấ, ữ, ọ…) on Google Fonts —
// a Vietnamese website uses Inter instead, so letters never mix two fonts.
export const NO_VIETNAMESE_FONTS = ['Poppins', 'Lato'];
export const siteFont = (D, lang) => (lang === 'vi' && NO_VIETNAMESE_FONTS.includes(D.fontName) ? "'Inter','system-ui',sans-serif" : D.font);
