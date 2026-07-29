export interface ExperienceItem {
  company: string;
  role: string;
  location?: string;
  start: string;
  end: string;
  current?: boolean;
  summary: string;
  highlights: string[];
  tech: string[];
  url?: string;
}

/**
 * Full professional history from Saurabh-Ahuja-Latest resume.
 * Ordered newest → oldest for timeline display.
 */
export const experience: ExperienceItem[] = [
  {
    company: 'Oracle India Pvt. Ltd.',
    role: 'Principal Data Systems Engineer',
    location: 'Bangalore, India',
    start: 'Oct 2017',
    end: 'Present',
    current: true,
    summary:
      'Principal platform / data systems engineer building Kubernetes operators, infrastructure automation, and secure deployment patterns for Oracle Database platforms on cloud-native infrastructure.',
    highlights: [
      'Design and maintain Kubernetes Operators, CRDs, and reconciliation controllers in Go (Kubebuilder, controller-runtime, Operator SDK) for Oracle Database platforms (RAC, DBCS).',
      'Automate secure database lifecycle management — Kubernetes Secrets, Oracle TDE wallets, TCPS, OpenSSL certificate management, and encrypted configuration.',
      'Build Ansible automation for Oracle RAC provisioning with Ansible Vault for credentials and certificates; Terraform modules for OKE with secure RBAC.',
      'Integrate Kubernetes workloads and CI/CD with Oracle Identity Cloud Service (IDCS), OAuth2, and SAML enterprise identity workflows.',
      'Operationalize security scanning (Fortify, McAfee, Anchore, Burp Suite) across cloud-native build and release pipelines.',
      'Contribute to Oracle open source (operators, docker-images) and official product documentation / OKE whitepapers; mentor engineers and support hiring.',
      'Notable: RAC on Podman/OL and OLCNE docs; DBCS controller enhancements (KMS Vault encryption, automated PDB); RAC controller ASM device lifecycle for 19c/23ai; IDCS migration from JDK 8 to GraalVM.',
    ],
    tech: [
      'Kubernetes',
      'Go',
      'Oracle Database',
      'OCI',
      'OKE',
      'Terraform',
      'Ansible',
      'IDCS',
      'Docker',
      'Podman',
      'CI/CD',
    ],
    url: 'https://www.oracle.com',
  },
  {
    company: 'Optum Global Solutions (India) Pvt. Ltd.',
    role: 'Senior Engineer – Build and Release',
    location: 'Bangalore, India',
    start: 'Feb 2016',
    end: 'Sep 2017',
    summary:
      'Senior build-and-release engineer delivering CI/CD and containerization for private cloud products.',
    highlights: [
      'Designed and implemented CI/CD pipelines for private cloud products using Jenkins, OpenShift, and Bitbucket.',
      'Implemented containerization strategies using Docker and Kubernetes.',
      'Enabled SonarQube and Fortify security scans for private cloud workloads.',
      'Delivered end-to-end CI/CD solutions supporting production deployments across multiple enterprise projects.',
    ],
    tech: ['Jenkins', 'OpenShift', 'Docker', 'Kubernetes', 'Bitbucket', 'SonarQube', 'Fortify'],
    url: 'https://www.optum.com',
  },
  {
    company: 'Avesta Computer Pvt. Ltd.',
    role: 'Software Engineer',
    location: 'Bangalore, India',
    start: 'Jun 2014',
    end: 'Feb 2016',
    summary:
      'Build automation and quality tooling for enterprise (Cisco) projects — SCM, Jenkins, and SonarQube at scale.',
    highlights: [
      'Managed Subversion, GitLab, SonarQube, and Jenkins-based build automation.',
      'Led adoption of SonarQube dashboards across more than 20 Cisco projects.',
      'Migrated and stabilized Jenkins infrastructure from a single master hosting multiple concurrent project instances.',
    ],
    tech: ['Jenkins', 'GitLab', 'Subversion', 'SonarQube', 'CI/CD'],
  },
  {
    company: 'Aptean Software India Pvt. Ltd.',
    role: 'Configuration Management Engineer',
    location: 'Bangalore, India',
    start: 'Apr 2013',
    end: 'May 2014',
    summary:
      'Configuration management and release engineering for the Saratoga CRM product line.',
    highlights: [
      'Developed CI/CD pipelines for Saratoga CRM product releases.',
      'Built Windows installers (rich client and thin client) using InstallShield (Flexera).',
    ],
    tech: ['CI/CD', 'InstallShield', 'Windows', 'Release management'],
    url: 'https://www.aptean.com',
  },
  {
    company: 'Dell International Services India Pvt. Ltd.',
    role: 'Application Management Analyst',
    location: 'Bangalore, India',
    start: 'Mar 2011',
    end: 'Mar 2013',
    summary:
      'Application management and release operations for Dell enterprise applications and large Windows estates.',
    highlights: [
      'Managed QA environments and monthly production deployments for Dell enterprise apps including OrderBroker and Dell Premier.',
      'Led Windows monthly patching for 1000+ servers across Dev/QA, Stage, and Production for Dell Releases Infrastructure.',
    ],
    tech: ['Release management', 'Windows', 'QA environments', 'Patching'],
    url: 'https://www.dell.com',
  },
  {
    company: 'Accenture Services Pvt. Ltd.',
    role: 'Software Engineer',
    location: 'Bangalore, India',
    start: 'Dec 2009',
    end: 'Mar 2011',
    summary:
      'Build and release automation for insurance platforms — first industry role after graduation.',
    highlights: [
      'Developed CI/CD pipelines for insurance platforms.',
      'Automated build and release processes using CruiseControl, Java, Maven, and Artifactory.',
    ],
    tech: ['Java', 'Maven', 'CruiseControl', 'Artifactory', 'CI/CD'],
    url: 'https://www.accenture.com',
  },
];

export interface EducationItem {
  school: string;
  degree: string;
  field: string;
  start: string;
  end: string;
  details?: string;
}

export const education: EducationItem[] = [
  {
    school: 'Punjab Engineering College (PEC), Chandigarh',
    degree: 'B.E.',
    field: 'Information Technology',
    start: '2005',
    end: '2009',
    details: 'Bachelor of Engineering in Information Technology.',
  },
];
