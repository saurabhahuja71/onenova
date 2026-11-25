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
    role: 'Sr Principal Data Systems Engineer',
    location: 'Bangalore, India',
    start: 'Oct 2017',
    end: 'Present',
    current: true,
    summary:
      'Principal platform / data systems engineer building Kubernetes operators, infrastructure automation, and secure deployment patterns for Oracle Database platforms on cloud-native infrastructure.',
    highlights: [
      'Design and maintain Go-based Kubernetes operators, CRDs, and controllers (Kubebuilder, controller-runtime, Operator SDK) for Oracle Database platforms (26ai, 19c) — Single Instance, RAC, DBCS, Oracle Restart, True Cache, and Private Agent Factory, including RU patching and fault-tolerant control-plane operations.',
      'Build E2E test automation for provisioning, scaling, failover, and upgrades of Oracle Database on Kubernetes.',
      'Implement security controls for Kubernetes database operations — Secrets, Oracle TDE wallets, TCPS, OpenSSL certificates, and encrypted configuration; Ansible Vault for RAC credentials.',
      'Deliver Terraform/Ansible automation for OKE with secure RBAC; IDCS OAuth2/SAML workflows with Identity, Security, and Platform partners.',
      'Integrate Fortify, McAfee, Anchore, and Burp Suite into cloud-native pipelines; harden operators against injection, secret exposure, and invalid storage/ASM configs.',
      'Contribute to Oracle open source and official docs/whitepapers; mentor engineers and support hiring.',
      'Notable: RAC ASM lifecycle and scale reliability; cross-cluster Data Guard TCPS (broker, wallets, switchover); Oracle Restart E2E automation on OCI; True Cache on Kubernetes MAA material; IDCS migration from JDK 8 to GraalVM 20.3.3.',
    ],
    tech: [
      'Kubernetes',
      'Go',
      'Oracle Database',
      'True Cache',
      'Data Guard',
      'CMAN',
      'OCI',
      'OKE',
      'Terraform',
      'Ansible',
      'IDCS',
      'TCPS',
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
    details: 'Bachelor of Engineering in Information Technology · CGPA 7.9.',
  },
];
