interface RawPageData {
	text: string;
	page: number;
	x: number;
	y: number;
    fontSize: number;
}

interface ReconstructedLine {
	text: string;
	page: number;
	lineNumber: number;
	paragraphNumber: number;
	yTop: number; // Represent the vertical bounds of a reconstructed line
	yBottom: number; // Represent the vertical bounds of a reconstructed line
    fontSize: number;
}

interface Paragraph {
	text: string;
	page: number;
	paragraphNumber: number;
	lines: ReconstructedLine[];
}

export function constructLayout(rawPageData: RawPageData[], numPages: number): Paragraph[] {
	const reconstructedParagraphs: Paragraph[] = [];

	for (let pageNum = 1; pageNum <= numPages; pageNum++) {
		// Arrange fragments for this page
		const pageFragments = rawPageData
			.filter((f) => f.page === pageNum)
			.sort((a, b) => {
				if (b.y !== a.y) return b.y - a.y; // top to bottom
				return a.x - b.x; // left to right
			});

		let lines: ReconstructedLine[] = [];
		let currentLineFrags: RawPageData[] = []; // Array that collects all fragments for the current line.
		let lastY: number | null = null; //  the y position of the previous fragment while building a line.
		let lineNumber = 0;

		// Group fragments into lines
		for (const frag of pageFragments) {
            // adaptive line threshold based on font size
            const k = 0.15; // constant fraction of font size to allow for small vertical variations
            const lineThreshold = frag.fontSize ? frag.fontSize * k : 2; // max y-difference to consider same line, defaultly its 0.07cm at 72dpi

			// If this is the first fragment, or the fragment's y-position is close enough to the last one,
            // consider it part of the same line and add it to the current line's fragments.
            if (lastY === null || Math.abs(frag.y - lastY) <= lineThreshold) {
                currentLineFrags.push(frag);
            } else {
				// finish current line
				lineNumber++;
				const lineText = currentLineFrags.map((f) => f.text).join(' ');
				const yTop = Math.max(...currentLineFrags.map((f) => f.y));
				const yBottom = Math.min(...currentLineFrags.map((f) => f.y));
				lines.push({
					text: lineText,
					page: pageNum,
					lineNumber,
					paragraphNumber: 0,
					yTop,
					yBottom,
                    fontSize: currentLineFrags[0].fontSize
				});

				// start new line since y difference is too big
				currentLineFrags = [frag];
			}
			lastY = frag.y;
		}

		// push last line
		if (currentLineFrags.length) {
			lineNumber++;
			const lineText = currentLineFrags.map((f) => f.text).join(' ');
			const yTop = Math.max(...currentLineFrags.map((f) => f.y));
			const yBottom = Math.min(...currentLineFrags.map((f) => f.y));
			lines.push({
				text: lineText,
				page: pageNum,
				lineNumber,
				paragraphNumber: 0,
				yTop,
				yBottom,
                fontSize: currentLineFrags[0].fontSize
			});
		}

		// Group lines into paragraphs
		let paragraphs: Paragraph[] = [];
		let currentParagraphLines: ReconstructedLine[] = [];
		let paragraphNumber = 0;
		let lastLineY: number | null = null;

        const kParagraph = 1.5; // 1.5 × fontSize or more

        for (const line of lines) {
            // dynamic paragraph threshold per line
            const paragraphThreshold = (line.fontSize || 12) * kParagraph;

            if (lastLineY === null || Math.abs(line.yTop - lastLineY) <= paragraphThreshold) {
                currentParagraphLines.push(line);
            } else {
                // finish paragraph
                paragraphNumber++;
                currentParagraphLines.forEach((l) => (l.paragraphNumber = paragraphNumber));
                paragraphs.push({
                    text: currentParagraphLines.map((l) => l.text).join(' '),
                    page: pageNum,
                    paragraphNumber,
                    lines: currentParagraphLines,
                });

                // start new paragraph
                currentParagraphLines = [line];
            }

            lastLineY = line.yTop;
        }

		// push last paragraph
		if (currentParagraphLines.length) {
			paragraphNumber++;
			currentParagraphLines.forEach(
				(l) => (l.paragraphNumber = paragraphNumber)
			);
			paragraphs.push({
				text: currentParagraphLines.map((l) => l.text).join(' '),
				page: pageNum,
				paragraphNumber,
				lines: currentParagraphLines,
			});
		}

		// 4Add page paragraphs to global list
		reconstructedParagraphs.push(...paragraphs);
	}

    return reconstructedParagraphs;
}
