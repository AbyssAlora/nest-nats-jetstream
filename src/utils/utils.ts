export const uniqueNameFrom = (name: string, subject: string) => {
  return `${name}-${subject
    .replaceAll('.', '_')
    .replaceAll('*', '$')
    .replace('>', '+')}`;
};
