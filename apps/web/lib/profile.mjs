/** Build an editable profile payload without server-owned identity fields.
 * @param {{name: string, phone: string, language: 'en' | 'bn'}} profile
 */
export function editableProfile(profile) {
  return { name: profile.name, phone: profile.phone, language: profile.language };
}
