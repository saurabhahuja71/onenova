export const siteConfig = {
  name: 'Saurabh Ahuja',
  title: 'Saurabh Ahuja — Principal Platform Engineer',
  shortName: 'OneNova',
  description:
    'Principal Platform Engineer with 16+ years building cloud-native platforms, Kubernetes operators, identity-aware infrastructure, and secure deployment pipelines.',
  url: 'https://onenova.in',
  locale: 'en_IN',
  author: {
    name: 'Saurabh Ahuja',
    email: 'saurabh@onenova.in',
    role: 'Principal Data Systems Engineer',
    company: 'Oracle India',
    team: 'Data systems · Kubernetes operators · Database platforms',
    location: 'Bangalore, India',
    bio: 'Principal Platform Engineer | Kubernetes operators | Go | OCI | Oracle Database | Identity-aware infrastructure | CI/CD',
    yearsExperience: '16+',
  },
  social: {
    github: 'https://github.com/saurabhahuja71',
    githubUser: 'saurabhahuja71',
    githubPages: 'https://github.com/saurabhahuja71/saurabhahuja71.github.io',
    githubProfileSite: 'https://saurabhahuja71.github.io',
    learningPath: 'https://github.com/saurabhahuja71/learning-path',
    linkedin: 'https://www.linkedin.com/in/saurabhahuja71',
    email: 'mailto:saurabh@onenova.in',
    twitter: '',
  },
  links: {
    resume: '/resume/Saurabh-Ahuja-Latest.pdf',
    resumePdf: '/resume/Saurabh-Ahuja-Latest.pdf',
    resumeDocx: '/resume/Saurabh-Ahuja-Latest.docx',
    /** @deprecated alias kept for older bookmarks */
    resumeLegacy: '/resume/Saurabh_Ahuja_Resume.pdf',
    resumePage: '/resume',
    profile: '/profile',
    learningPath: '/learning-path',
  },
  nav: [
    { label: 'Profile', href: '/profile' },
    { label: 'About', href: '/about' },
    { label: 'Experience', href: '/experience' },
    { label: 'Skills', href: '/skills' },
    { label: 'Projects', href: '/projects' },
    { label: 'Learning', href: '/learning-path' },
    { label: 'Blog', href: '/blog' },
    { label: 'Resume', href: '/resume' },
    { label: 'Contact', href: '/contact' },
  ],
  footer: {
    tagline: 'Quiet, predictable systems — kind to the people who maintain them.',
  },
} as const;

export type NavItem = (typeof siteConfig.nav)[number];
