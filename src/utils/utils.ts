export const uniqueNameFrom = (name: string, subject: string) => {
  return `${name}-${subject
    .replace(/./g, '_')
    .replace(/\*/g, '$')
    .replace('>', '+')}`;
};
