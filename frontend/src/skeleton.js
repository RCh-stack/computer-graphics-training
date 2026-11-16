(function (global) {
    function repeat(count, factory) {
        return Array.from({ length: Math.max(1, count) }, (_, index) => factory(index)).join('');
    }

    function resolveTarget(target) {
        if (!target) return null;
        if (typeof target === 'string') {
            return document.querySelector(target) || document.getElementById(target);
        }
        return target;
    }

    const Skeleton = {
        newsFeed(count = 3) {
            return repeat(count, () => `
                <div aria-hidden="true" class="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-start space-x-3 animate-pulse">
                    <div class="w-8 h-8 rounded-lg bg-gray-500/15 shrink-0 mt-0.5"></div>
                    <div class="flex-1 min-w-0 space-y-2.5 py-0.5">
                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-2 w-2/3">
                                <div class="h-4 w-20 rounded bg-gray-500/20 shrink-0"></div>
                                <div class="h-4 w-44 rounded bg-gray-500/15"></div>
                            </div>
                            <div class="h-3 w-20 rounded bg-gray-500/15 shrink-0"></div>
                        </div>
                        <div class="space-y-1.5">
                            <div class="h-3 w-full rounded bg-gray-500/15"></div>
                            <div class="h-3 w-3/4 rounded bg-gray-500/10"></div>
                        </div>
                    </div>
                </div>
            `);
        },

        tableRows(rows = 4, cols = 4) {
            const colWidths = ['w-20', 'w-48', 'w-14', 'w-24', 'w-28', 'w-16'];

            return repeat(rows, () => {
                const cells = repeat(cols, (colIdx) => {
                    const widthClass = colWidths[colIdx % colWidths.length];
                    const alignClass =
                        colIdx === cols - 1
                            ? 'text-right ml-auto'
                            : colIdx === cols - 2 && cols >= 4
                              ? 'text-center mx-auto'
                              : '';

                    return `
                        <td class="py-3.5 px-3">
                            <div class="h-3.5 ${widthClass} ${alignClass} rounded bg-gray-500/15"></div>
                        </td>
                    `;
                });

                return `<tr aria-hidden="true" class="animate-pulse">${cells}</tr>`;
            });
        },

        chaptersList(count = 3) {
            return repeat(count, () => `
                <div aria-hidden="true" class="space-y-2 py-1 animate-pulse">
                    <div class="flex justify-between items-center">
                        <div class="h-3.5 w-1/2 rounded bg-gray-500/20"></div>
                        <div class="h-3 w-12 rounded bg-gray-500/15"></div>
                    </div>
                    <div class="w-full h-2 rounded-full bg-gray-500/15"></div>
                </div>
            `);
        },

        cardsGrid(count = 4) {
            return repeat(count, () => `
                <div aria-hidden="true" class="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col justify-between space-y-5 animate-pulse">
                    <div class="space-y-3">
                        <div class="w-11 h-11 rounded-xl bg-gray-500/15"></div>
                        <div class="h-5 w-3/4 rounded bg-gray-500/20"></div>
                        <div class="space-y-1.5">
                            <div class="h-3 w-full rounded bg-gray-500/15"></div>
                            <div class="h-3 w-5/6 rounded bg-gray-500/10"></div>
                        </div>
                    </div>
                    <div class="h-9 w-full rounded-lg bg-gray-500/15"></div>
                </div>
            `);
        },

        courseMenu(chaptersCount = 2, lessonsPerChapter = 3) {
            return repeat(chaptersCount, () => {
                const lessonsHtml = repeat(lessonsPerChapter, (idx) => {
                    const widths = ['w-4/5', 'w-3/4', 'w-5/6', 'w-2/3'];
                    return `
                        <div class="flex items-center justify-between p-2 rounded-xl gap-2">
                            <div class="h-3 ${widths[idx % widths.length]} rounded bg-gray-500/15"></div>
                            <div class="w-3 h-3 rounded-full bg-gray-500/15 shrink-0"></div>
                        </div>
                    `;
                });

                return `
                    <div aria-hidden="true" class="space-y-1.5 animate-pulse">
                        <div class="mt-3 mb-1 px-2 flex justify-between items-center gap-2">
                            <div class="h-2.5 w-1/2 rounded bg-gray-500/20"></div>
                            <div class="h-3.5 w-8 rounded bg-gray-500/15"></div>
                        </div>
                        ${lessonsHtml}
                    </div>
                `;
            });
        },

        lessonArticle() {
            return `
                <div aria-hidden="true" class="max-w-2xl mx-auto space-y-6 pb-12 animate-pulse">
                    <div class="border-b border-[var(--border-color)] pb-4 space-y-2.5">
                        <div class="h-3 w-28 rounded bg-indigo-500/20"></div>
                        <div class="h-7 w-3/4 rounded-lg bg-gray-500/20"></div>
                    </div>

                    <div class="space-y-3">
                        <div class="h-3.5 w-full rounded bg-gray-500/15"></div>
                        <div class="h-3.5 w-11/12 rounded bg-gray-500/15"></div>
                        <div class="h-3.5 w-4/5 rounded bg-gray-500/15"></div>
                    </div>

                    <div class="h-44 w-full rounded-2xl bg-gray-500/10 border border-[var(--border-color)]"></div>

                    <div class="space-y-3">
                        <div class="h-3.5 w-full rounded bg-gray-500/15"></div>
                        <div class="h-3.5 w-5/6 rounded bg-gray-500/15"></div>
                        <div class="h-3.5 w-2/3 rounded bg-gray-500/10"></div>
                    </div>

                    <div class="border-t border-[var(--border-color)] pt-6 mt-8 flex justify-center">
                        <div class="h-10 w-48 rounded-xl bg-gray-500/15"></div>
                    </div>
                </div>
            `;
        },

        testCards(count = 4) {
            return repeat(count, () => `
                <div aria-hidden="true" class="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl p-5 flex flex-col justify-between space-y-4 animate-pulse">
                    <div class="space-y-3">
                        <div class="flex items-center justify-between gap-2">
                            <div class="h-5 w-16 rounded bg-gray-500/15"></div>
                            <div class="h-6 w-24 rounded-md bg-gray-500/20"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-5 w-3/4 rounded bg-gray-500/20"></div>
                            <div class="h-3 w-full rounded bg-gray-500/15"></div>
                            <div class="h-3 w-2/3 rounded bg-gray-500/10"></div>
                        </div>
                    </div>
                    <div class="pt-4 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
                        <div class="flex gap-3">
                            <div class="h-3.5 w-14 rounded bg-gray-500/15"></div>
                            <div class="h-3.5 w-14 rounded bg-gray-500/15"></div>
                        </div>
                        <div class="h-8 w-20 rounded-lg bg-gray-500/20"></div>
                    </div>
                </div>
            `);
        },

        questionPalette(count = 10) {
            return repeat(count, () => `
                <div aria-hidden="true" class="h-9 w-9 rounded-xl bg-gray-500/15 animate-pulse"></div>
            `);
        },

        questionOptions(count = 4) {
            return repeat(count, () => `
                <div aria-hidden="true" class="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] flex items-center gap-3 animate-pulse">
                    <div class="w-4 h-4 rounded-full bg-gray-500/20 shrink-0"></div>
                    <div class="h-3.5 w-2/3 rounded bg-gray-500/15"></div>
                </div>
            `);
        },

        labCards(count = 4) {
            return repeat(count, () => `
                <div aria-hidden="true" class="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-5 flex flex-col justify-between space-y-4 animate-pulse">
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <div class="h-6 w-28 rounded-lg bg-gray-500/20"></div>
                            <div class="w-2 h-2 rounded-full bg-gray-500/20"></div>
                        </div>
                        <div class="h-5 w-3/4 rounded bg-gray-500/20"></div>
                        <div class="space-y-1.5">
                            <div class="h-3 w-full rounded bg-gray-500/15"></div>
                            <div class="h-3 w-5/6 rounded bg-gray-500/10"></div>
                        </div>
                    </div>
                    <div class="pt-6 border-t border-[var(--border-color)] flex items-center justify-between">
                        <div class="h-5 w-16 rounded bg-gray-500/15"></div>
                        <div class="h-8 w-24 rounded-xl bg-gray-500/20"></div>
                    </div>
                </div>
            `);
        },

        labTestCases(count = 4) {
            return repeat(count, () => `
                <div aria-hidden="true" class="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl p-2.5 flex items-center justify-between animate-pulse">
                    <div class="flex items-center space-x-2 w-2/3">
                        <div class="w-2 h-2 rounded-full bg-gray-500/20 shrink-0"></div>
                        <div class="h-3.5 w-3/4 rounded bg-gray-500/15"></div>
                    </div>
                    <div class="h-3 w-10 rounded bg-gray-500/15"></div>
                </div>
            `);
        },

        gradebookRows(rows = 5, dynamicCols = 4) {
            return repeat(rows, () => {
                const metricCells = repeat(dynamicCols, () => `
                    <td class="p-3 text-center">
                        <div class="h-6 w-16 mx-auto rounded-lg bg-gray-500/15"></div>
                    </td>
                `);

                return `
                    <tr aria-hidden="true" class="border-b border-[var(--border-color)] animate-pulse">
                        <td class="p-3">
                            <div class="h-3.5 w-36 rounded bg-gray-500/20"></div>
                            <div class="h-2.5 w-44 rounded bg-gray-500/10 mt-1.5"></div>
                        </td>
                        <td class="p-3">
                            <div class="h-3.5 w-20 rounded bg-gray-500/15"></div>
                        </td>
                        ${metricCells}
                    </tr>
                `;
            });
        },

        testQuestionEditor() {
            return `
                <div aria-hidden="true" class="space-y-4 animate-pulse">
                    <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                        <div class="h-5 w-28 rounded bg-amber-500/20"></div>
                        <div class="h-7 w-24 rounded-lg bg-gray-500/15"></div>
                    </div>
                    <div class="space-y-2">
                        <div class="h-3 w-24 rounded bg-gray-500/15"></div>
                        <div class="h-20 w-full rounded-xl bg-gray-500/15"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="h-10 rounded-xl bg-gray-500/15"></div>
                        <div class="h-10 rounded-xl bg-gray-500/15"></div>
                    </div>
                    <div class="space-y-2 pt-2">
                        <div class="h-9 w-full rounded-lg bg-gray-500/15"></div>
                        <div class="h-9 w-full rounded-lg bg-gray-500/15"></div>
                    </div>
                </div>
            `;
        },

        ebookChaptersTree(chaptersCount = 3, lessonsPerChapter = 2) {
            return repeat(chaptersCount, () => {
                const lessonsRows = repeat(lessonsPerChapter, () => `
                    <div class="p-3 flex justify-between items-center">
                        <div class="flex items-center gap-2 w-2/3">
                            <div class="h-4 w-10 rounded bg-blue-500/15 shrink-0"></div>
                            <div class="h-3.5 w-3/4 rounded bg-gray-500/15"></div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="h-3.5 w-24 rounded bg-gray-500/15"></div>
                            <div class="h-3.5 w-3.5 rounded bg-gray-500/15"></div>
                        </div>
                    </div>
                `);

                return `
                    <div aria-hidden="true" class="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden animate-pulse">
                        <div class="p-4 flex justify-between items-center border-b border-[var(--border-color)]">
                            <div class="flex items-center gap-3 w-1/2">
                                <div class="w-7 h-7 rounded-lg bg-blue-500/15 shrink-0"></div>
                                <div class="h-4 w-2/3 rounded bg-gray-500/20"></div>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="h-7 w-24 rounded-lg bg-blue-500/15"></div>
                                <div class="h-7 w-7 rounded-lg bg-gray-500/15"></div>
                            </div>
                        </div>
                        <div class="p-2 divide-y divide-gray-600/40">
                            ${lessonsRows}
                        </div>
                    </div>
                `;
            });
        },

        widgetCards(count = 1) {
            return repeat(count, () => `
                <div aria-hidden="true" class="bg-[var(--bg-panel)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-3 animate-pulse">
                    <div class="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
                        <div class="h-3.5 w-20 rounded bg-blue-500/20"></div>
                        <div class="h-3.5 w-14 rounded bg-gray-500/15"></div>
                    </div>
                    <div class="space-y-1.5">
                        <div class="h-2.5 w-20 rounded bg-gray-500/15"></div>
                        <div class="h-8 w-full rounded-lg bg-gray-500/15"></div>
                    </div>
                    <div class="space-y-1.5">
                        <div class="h-2.5 w-28 rounded bg-gray-500/15"></div>
                        <div class="h-24 w-full rounded-lg bg-gray-500/15"></div>
                    </div>
                </div>
            `);
        },

        userTableRows(rows = 5, cols = 5) {
            return repeat(rows, () => {
                if (cols === 4) {
                    return `
                        <tr aria-hidden="true" class="animate-pulse">
                            <td class="py-3.5 px-4 flex items-center gap-2">
                                <div class="w-7 h-7 rounded-lg bg-pink-500/15 shrink-0"></div>
                                <div class="h-3.5 w-36 rounded bg-gray-500/20"></div>
                            </td>
                            <td class="py-3.5 px-4">
                                <div class="h-3 w-44 rounded bg-gray-500/15"></div>
                            </td>
                            <td class="py-3.5 px-4">
                                <div class="h-3 w-20 rounded bg-gray-500/15"></div>
                            </td>
                            <td class="py-3.5 px-4 text-right">
                                <div class="h-7 w-24 ml-auto rounded-lg bg-gray-500/15"></div>
                            </td>
                        </tr>
                    `;
                }

                return `
                    <tr aria-hidden="true" class="animate-pulse">
                        <td class="py-3.5 px-4">
                            <div class="h-3.5 w-36 rounded bg-gray-500/20"></div>
                        </td>
                        <td class="py-3.5 px-4">
                            <div class="h-4 w-32 rounded bg-gray-500/15"></div>
                        </td>
                        <td class="py-3.5 px-4">
                            <div class="h-3.5 w-24 rounded bg-gray-500/15"></div>
                        </td>
                        <td class="py-3.5 px-4 text-center">
                            <div class="h-6 w-24 mx-auto rounded-lg bg-gray-500/15"></div>
                        </td>
                        <td class="py-3.5 px-4 text-right">
                            <div class="h-7 w-24 ml-auto rounded-lg bg-gray-500/15"></div>
                        </td>
                    </tr>
                `;
            });
        },

        labTestCaseEditor() {
            return `
                <div aria-hidden="true" class="space-y-4 animate-pulse">
                    <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                        <div class="h-5 w-24 rounded bg-emerald-500/20"></div>
                        <div class="h-7 w-20 rounded-lg bg-gray-500/15"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="h-9 rounded-xl bg-gray-500/15"></div>
                        <div class="h-9 rounded-xl bg-gray-500/15"></div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="h-24 rounded-xl bg-gray-500/15"></div>
                        <div class="h-24 rounded-xl bg-gray-500/15"></div>
                    </div>
                </div>
            `;
        },

        render(target, html) {
            const el = resolveTarget(target);
            if (el) {
                el.innerHTML = html;
            }
        },
    };

    global.Skeleton = Skeleton;
})(window);