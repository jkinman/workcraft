const yaml = require('js-yaml');
const { parseCVContent } = require('../../cv-parser');
const { cvToObject, cvObjectToMarkdown } = require('./resume-schema');
const { profileToObject, profileObjectToYaml } = require('./profile-schema');
const { portalsToObject, portalsObjectToYaml } = require('./portals-schema');

const REQUIRED_RESUME_SECTIONS = ['### Summary', '### Skills', '### Experience'];

function parseYamlOrThrow(text, label) {
  try {
    const parsed = yaml.load(text);
    if (parsed === undefined || parsed === null) {
      throw new Error(`${label} is empty`);
    }
    if (typeof parsed !== 'object') {
      throw new Error(`${label} must be a YAML mapping`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid ${label}: ${error.message}`);
  }
}

function validatePortalsShape(parsed) {
  const issues = [];
  if (parsed.title_filter && typeof parsed.title_filter !== 'object') {
    issues.push('title_filter must be a mapping');
  }
  if (parsed.search_queries && !Array.isArray(parsed.search_queries)) {
    issues.push('search_queries must be a list');
  }
  if (parsed.tracked_companies && !Array.isArray(parsed.tracked_companies)) {
    issues.push('tracked_companies must be a list');
  }
  if (issues.length) {
    throw new Error(`Invalid portals config: ${issues.join('; ')}`);
  }
}

function findMissingResumeSections(markdown) {
  return REQUIRED_RESUME_SECTIONS.filter(section => !markdown.includes(section));
}

function createSettingsService(dataClient) {
  function getProfile() {
    return { content: dataClient.readProfile() || '' };
  }

  async function saveProfile(content) {
    parseYamlOrThrow(content, 'profile YAML');
    await dataClient.writeProfile(content);
    return { saved: true };
  }

  function getProfileStructured() {
    const content = dataClient.readProfile() || '';
    return { profile: profileToObject(content) };
  }

  // Candidate details + role suggestions derived from the imported resume,
  // so the profile can be prefilled from cv.md instead of retyped.
  function getResumePrefill() {
    const content = dataClient.readCv() || '';
    const resume = cvToObject(content);
    const suggestedRoles = [];
    for (const exp of resume.experience) {
      const role = (exp.role || '').trim();
      if (role && !suggestedRoles.includes(role)) suggestedRoles.push(role);
    }
    return {
      hasResume: Boolean(content.trim()),
      candidate: {
        full_name: resume.name || '',
        email: resume.contact.email || '',
        phone: resume.contact.phone || '',
        location: resume.contact.location || '',
        linkedin: resume.contact.linkedin || '',
        portfolio_url: resume.contact.website || ''
      },
      suggestedRoles: suggestedRoles.slice(0, 6)
    };
  }

  async function saveProfileStructured(profile) {
    if (!profile || typeof profile !== 'object') {
      throw new Error('Profile data is required');
    }
    const content = profileObjectToYaml(profile, dataClient.readProfile() || '');
    parseYamlOrThrow(content, 'profile YAML');
    await dataClient.writeProfile(content);
    return { saved: true, profile: profileToObject(content) };
  }

  function getPortals() {
    return { content: dataClient.readPortals() || '' };
  }

  async function savePortals(content) {
    const parsed = parseYamlOrThrow(content, 'portals YAML');
    validatePortalsShape(parsed);
    await dataClient.writePortals(content);
    return { saved: true };
  }

  function getPortalsStructured() {
    const content = dataClient.readPortals() || '';
    return { portals: portalsToObject(content) };
  }

  async function savePortalsStructured(portals) {
    if (!portals || typeof portals !== 'object') {
      throw new Error('Search settings data is required');
    }
    const content = portalsObjectToYaml(portals, dataClient.readPortals() || '');
    const parsed = parseYamlOrThrow(content, 'portals YAML');
    validatePortalsShape(parsed);
    await dataClient.writePortals(content);
    return { saved: true, portals: portalsToObject(content) };
  }

  function getStrategy() {
    return { content: dataClient.readAgentProfile() || '' };
  }

  async function saveStrategy(content) {
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Strategy content is required');
    }
    await dataClient.writeAgentProfile(content);
    return { saved: true };
  }

  function previewResume(markdown) {
    const parsed = parseCVContent(markdown);
    return {
      name: parsed.name,
      tagline: parsed.tagline,
      summary: parsed.summary,
      strengths: parsed.strengths,
      skills: parsed.skills,
      experience: parsed.experience.map(exp => ({
        company: exp.company,
        role: exp.role,
        date: exp.date,
        description: exp.description,
        highlights: exp.highlights,
        technologies: exp.technologies
      }))
    };
  }

  function getResume() {
    const content = dataClient.readCv() || '';
    return {
      content,
      missingSections: content ? findMissingResumeSections(content) : REQUIRED_RESUME_SECTIONS,
      preview: content ? previewResume(content) : null
    };
  }

  async function saveResume(content) {
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Resume content is required');
    }
    await dataClient.writeCv(content);
    return {
      saved: true,
      missingSections: findMissingResumeSections(content),
      preview: previewResume(content)
    };
  }

  function getResumeStructured() {
    const content = dataClient.readCv() || '';
    return {
      resume: cvToObject(content),
      hasContent: Boolean(content.trim())
    };
  }

  async function saveResumeStructured(resume) {
    if (!resume || typeof resume !== 'object') {
      throw new Error('Resume data is required');
    }
    const content = cvObjectToMarkdown(resume);
    await dataClient.writeCv(content);
    return {
      saved: true,
      resume: cvToObject(content),
      missingSections: findMissingResumeSections(content)
    };
  }

  function inspectResume(content) {
    const text = content || '';
    return {
      missingSections: text ? findMissingResumeSections(text) : REQUIRED_RESUME_SECTIONS,
      preview: text ? previewResume(text) : null
    };
  }

  async function listAssets() {
    const files = await dataClient.listGeneratedFiles();
    return {
      files: files.map(file => ({
        filename: file.filename,
        size: file.stat?.size ?? null,
        modified: file.stat?.mtime ?? null,
        downloadUrl: `/download-pdf?file=${encodeURIComponent(file.filename)}`
      }))
    };
  }

  return {
    getProfile,
    saveProfile,
    getProfileStructured,
    saveProfileStructured,
    getResumePrefill,
    getPortals,
    savePortals,
    getPortalsStructured,
    savePortalsStructured,
    getStrategy,
    saveStrategy,
    getResume,
    saveResume,
    getResumeStructured,
    saveResumeStructured,
    previewResume,
    inspectResume,
    listAssets
  };
}

module.exports = {
  REQUIRED_RESUME_SECTIONS,
  createSettingsService
};
