function normalizeEncoding(encoding) {
  if (!encoding) {
    return encoding;
  }

  const normalized = String(encoding).toLowerCase();
  if (normalized === 'utf-8') return 'utf8';
  if (normalized === 'utf-16le' || normalized === 'ucs-2') return 'utf16le';
  return normalized;
}

function getDecoder(encoding) {
  const normalized = normalizeEncoding(encoding);
  if (!normalized || !Buffer.isEncoding(normalized)) {
    throw new Error('Encoding not recognized: ' + encoding);
  }

  return {
    write(chunk) {
      return Buffer.isBuffer(chunk) ? chunk.toString(normalized) : Buffer.from(chunk).toString(normalized);
    },
    end() {
      return '';
    },
  };
}

function encodingExists(encoding) {
  if (!encoding) {
    return false;
  }

  return Buffer.isEncoding(normalizeEncoding(encoding));
}

module.exports = {
  getDecoder,
  encodingExists,
};