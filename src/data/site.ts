export const siteConfig = {
  name: 'Saurabh Ahuja',
  title: 'Saurabh Ahuja — Principal Engineer · Cloud & Infrastructure',
  shortName: 'OneNova',
  description:
    'Principal Engineer with 15+ years building reliable cloud and infrastructure systems — Kubernetes, operators, Oracle Database, Go, and open source.',
  url: 'https://onenova.in',
  locale: 'en_IN',
  author: {
    name: 'Saurabh Ahuja',
    email: 'saurabh@onenova.in',
    role: 'Principal Member of Technical Staff',
    company: 'Oracle',
    team: 'RACPACK MAA Solution Engineering',
    location: 'Bangalore, India',
    bio: 'Principal Engineer | Kubernetes Control Plane Architect | Distributed Systems | Golang | Operators | Oracle Database | Cloud-Native Platforms',
    yearsExperience: '15+',
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
    resume: '/resume/Saurabh_Ahuja_Resume.pdf',
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
