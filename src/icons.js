// One stroke vocabulary instead of platform-dependent Unicode pictograms.
const paths={
 up:'M12 21V3m-6 6 6-6 6 6',down:'M12 3v18m-6-6 6 6 6-6',left:'m15 5-7 7 7 7',right:'m9 5 7 7-7 7',
 play:'m8 4 12 8-12 8Z',pause:'M8 4v16M16 4v16',previous:'M5 4v16m14-16L7 12l12 8Z',next:'M19 4v16M5 4l12 8-12 8Z',
 volume:'M3 10h4l5-5v14l-5-5H3Zm13-2q3 4 0 8m3-11q5 7 0 14',
 power:'M12 2v10m-6-7a9 9 0 1 0 12 0',seat:'M7 3v10q0 3 3 3h9M4 8v7q0 5 5 5h10M10 4q3 2 0 4m4-4q3 2 0 4m4-4q3 2 0 4',
 defrost:'M3 17 1 7q11-7 22 0l-2 10M7 20V9m5 11V8m5 12V9M5 12l2-3 2 3m1-1 2-3 2 3m1 1 2-3 2 3',
 rearDefrost:'M2 5h20v12H2ZM7 21V8m5 13V8m5 13V8m-12 3 2-3 2 3m1 0 2-3 2 3m1 0 2-3 2 3',
 fan:'M12 11C3 6 10-2 14 3q2 3-2 8Zm1 1c5-9 13-2 8 2q-3 2-8-2Zm-1 1c9 5 2 13-2 8q-2-3 2-8Zm-1-1C6 21-2 14 3 10q3-2 8 2Z',
 flag:'M5 22V3m0 1c5-4 10 4 15 0v10c-5 4-10-4-15 0',screen:'M2 4h20v14H2Zm6 18h8m-4-4v4',
 home:'m2 11 10-9 10 9M5 9v12h14V9m-10 12v-7h6v7',work:'M3 7h18v14H3ZM8 7V3h8v4M3 12h18m-9-2v5',
 full:'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6',info:'M12 10v8m0-13v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 tools:'M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-8 0v6',rotate:'M20 6V1m0 5h-5m5 0a9 9 0 1 0 1 10',
};
export const icon=(name)=>`<svg class="icon icon-${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${paths[name]||paths.screen}"/></svg>`;
