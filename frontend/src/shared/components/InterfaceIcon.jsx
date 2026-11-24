/** Small, consistent navigation symbols; labels always remain visible. */
export function InterfaceIcon({ name, size = 24 }) {
  const paths = {
    home: 'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
    groups: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M17 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    map: 'M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7',
    book: 'M12 5v16M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1',
    paper: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
    pencil: 'm4 16 12-12 4 4L8 20H4zM13 7l4 4',
    star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
    spark: 'm12 3 2 7 7 2-7 2-2 7-2-7-7-2 7-2z',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d={paths[name] || paths.spark} /></svg>;
}
