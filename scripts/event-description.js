(function (root) {
  // Metadata belongs to the editor, not the public event description.
  function descriptionText(value) {
    const template = document.createElement('template');
    template.innerHTML = value || '';
    template.content.querySelectorAll('script, style').forEach((node) => node.remove());
    template.content.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    template.content.querySelectorAll('p, div').forEach((node) => node.append('\n'));
    return template.content.textContent;
  }
  function plainText(value) {
    return descriptionText(value)
      .replace(/\[KCW_METADATA\][\s\S]*?(?:\[\/KCW_METADATA\]|$)/gi, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  function metadata(value) {
    const match = descriptionText(value).match(/\[KCW_METADATA\]([\s\S]*?)\[\/KCW_METADATA\]/i);
    if (!match) return {};
    try {
      const parsed = JSON.parse(match[1]);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const result = { featured: parsed.featured === true };
      if (Object.prototype.hasOwnProperty.call(parsed, 'status')) {
        result.status = typeof parsed.status === 'string' ? parsed.status.trim() : '';
      }
      for (const key of ['type', 'eventTitle', 'learningTopic', 'learningOutcome', 'format',
        'speaker', 'speakerRole', 'speakerUrl', 'image', 'imageAlt', 'hoverText', 'address',
        'directions', 'featureStart', 'featureEnd']) {
        if (typeof parsed[key] === 'string') result[key] = parsed[key].trim();
      }
      return result;
    } catch {
      return {};
    }
  }
  function isPublic(metadata) {
    // Older calendar entries without an editorial status remain visible.
    return metadata.status === undefined || metadata.status.toLowerCase() === 'published';
  }
  function isFeatured(metadata, today) {
    const validDate = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
    return isPublic(metadata) && metadata.featured === true && validDate(metadata.featureStart) && validDate(metadata.featureEnd)
      && (!metadata.featureStart || today >= metadata.featureStart)
      && (!metadata.featureEnd || today <= metadata.featureEnd);
  }
  root.KCWEventDescription = { plainText, metadata, isPublic, isFeatured };
})(window);
