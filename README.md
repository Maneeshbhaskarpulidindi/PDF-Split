# PDF Slicer

A fast, lightweight, and **100% local** single-page web application to extract, combine, split, and reorder pages of a PDF document directly in your browser.

## Features

- **Privacy First (100% Local)**: Your files never leave your device. All processing is done securely within your browser using JavaScript.
- **Visual Interface**: Provides a scrollable filmstrip of page thumbnails and a high-quality preview of the selected page.
- **Two Powerful Modes**:
  - **Pick & Act**: Select specific pages, drag and drop to reorder them, and either combine them into a single new PDF or split them into individual PDF files.
  - **Named Slices**: Break a large document into multiple distinct named sections (slices). You can download them individually or all at once as a ZIP archive.
- **Range Selection**: Quickly select pages by typing ranges (e.g., `1-5, 8, 11-15`).
- **Drag-and-Drop Reordering**: Easily change the order of pages within your selection or slices before exporting.
- **Keyboard Shortcuts**:
  - `Ctrl + A`: Select all pages
  - `Esc`: Clear selection
  - `Ctrl + Enter`: Quick download
- **Sleek UI**: Dark mode interface built with vanilla CSS variables and intuitive SVG icons.

## Technologies Used

This application is built using standard web technologies (HTML, Vanilla CSS, Vanilla JavaScript) and relies on the following powerful open-source libraries via CDN:

- [PDF.js (Mozilla)](https://mozilla.github.io/pdf.js/) (`v3.11.174`): Used to parse and render the visual thumbnails and page previews on HTML `<canvas>` elements.
- [pdf-lib](https://pdf-lib.js.org/) (`v1.17.1`): The core library used to manipulate the PDF binary data (extracting, copying, and creating new PDF documents).
- [JSZip](https://stuk.github.io/jszip/) (`v3.10.1`): Used to bundle multiple output PDFs into a single `.zip` file for easy downloading.

## How to Use

1. **Open the App**: Simply open `pdf-slicer-v3.html` in any modern web browser.
2. **Load a PDF**: Drag and drop a PDF file onto the drop screen, or click to open your file browser.
3. **Choose a Mode**:
   - In **Pick & Act**, click thumbnails or type a range to select pages. Drag the pages in the right panel to reorder them, then click "Combine" or "Split".
   - In **Named Slices**, click "Add a new slice", give it a name, enter the page ranges, and click "Download all as ZIP" when you're ready.
4. **Export**: Confirm the output details in the popup modal to save your new PDF(s) to your device.

## Note on Performance
Performance and maximum supported file sizes depend on the memory limits of your local web browser.

## License

This project is a standalone HTML application incorporating third-party open-source libraries. Please refer to the respective licenses of `pdf.js`, `pdf-lib`, and `jszip` for their usage terms.
