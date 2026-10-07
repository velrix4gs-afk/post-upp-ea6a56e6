/**
 * Copy text to the clipboard, falling back to the legacy execCommand path.
 *
 * `navigator.clipboard` is undefined outside a secure context and its
 * writeText() rejects when the document is not focused or the permission is
 * denied. Callers previously awaited it with no catch, so "copy link" silently
 * did nothing and reported nothing.
 *
 * Returns true only when the text is believed to be on the clipboard, so the
 * caller can tell the user something useful either way.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fall through to the legacy path below.
  }

  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    // Keep it off-screen but still selectable.
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, value.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(field);
    return copied;
  } catch {
    return false;
  }
}
