import QRReader from 'qrcode-reader'
import QRWriter from 'qrcode'
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import moment from 'moment';
import QRCodeStyling from 'qr-code-styling';

class QRItem {
    src;
    fileName;
    url;

    constructor(src, fileName, url) {
        this.src = src;
        this.fileName = fileName;
        this.url = url;
    }
}

/** @type {QRItem[]} */
var items = [];

/** @type {QRItem[]} */
var errors = []

function updateItems() {
    // Set the file count
    document.getElementById('file_count').innerText = `${items.length} Archivo(s)`
    if (items.length > 0)
        document.getElementById('dl_all').removeAttribute('disabled')
    else
        document.getElementById('dl_all').setAttribute('disabled', true)

    // Clear the table
    let table = document.getElementById('image-table-body')
    table.innerHTML = '';
    let tmpl = document.getElementById('row-template');
    var i = 0
    for (var item of items) {
        let newItem = tmpl.content.cloneNode(true);
        let td = newItem.querySelectorAll("td");
        newItem.querySelectorAll("img")[0].src = item.src;
        td[1].innerText = item.fileName;
        newItem.querySelectorAll("a")[0].href = item.url;
        newItem.querySelectorAll("a")[0].innerText = item.url;
        // Buttons have the item index hardocded onto them so correct item can be downloaded
        newItem.querySelectorAll("button")[0].setAttribute('i', i++)
        newItem.querySelectorAll("button")[0].addEventListener("click", (event) => {
            let index = Number(event.target.getAttribute('i'))
            let item = items[index]
            dlQR(item.url, item.fileName)
        })
        table.appendChild(newItem);
    }
    // Add the errors too
    let errTmpl = document.getElementById('row-template-err');
    for (var item of errors) {
        let newItem = errTmpl.content.cloneNode(true);
        newItem.querySelectorAll("img")[0].src = item.src;
        let td = newItem.querySelectorAll("td");
        td[1].innerText = item.fileName;
        td[2].innerText = item.url;
        table.appendChild(newItem);
    }
}

// Download all files
document.getElementById('dl_all').addEventListener('click', async () => {
    // Create a new zip
    var zip = new JSZip();
    for (var item of items) {
        let dataURI = await createURI(item.url)
        zip.file(createNewFilename(item.fileName), dataURI, { base64: false });
    }
    let blob = await zip.generateAsync({ type: "blob" })
    saveAs(blob, `QRs ${moment().format()}.zip`);
})

// Replace the existing extension
function createNewFilename(old) {
    return old.replace(/\.[0-9a-z]+$/i, '.svg')
}

// Download a single file
async function dlQR(url, fileName) {
    let dataURI = await createURI(url, true)
    saveAs(dataURI, createNewFilename(fileName))
}

/** @type {Object<string,Partial<import('qr-code-styling').Options>>} */
const qrStyles = {
    "default": {
        // nothing unique
    },
    "black": {
        dotsOptions: {
            type: 'dots'
        },
        cornersDotOptions: {
            type: 'square'
        },
        cornersSquareOptions: {
            type: 'square'
        },
    },
    "white": {
        dotsOptions: {
            type: 'dots',
            color: '#ffffff',
        },
        cornersDotOptions: {
            type: 'square',
            color: '#ffffff'
        },
        cornersSquareOptions: {
            type: 'square',
            color: '#ffffff'
        },
    }
}

// Create a functional svg file given the output of QRWriter
async function createURI(url, encode = false) {
    // let uri = await QRWriter.toString(url, {
    //     type: 'svg',
    //     margin: 0,
    //     scale: 1,
    // })
    let style = document.querySelector('input[name="style"]:checked').value;
    let cutout = document.querySelector('input[name="cutout"]:checked').value;
    let uri = new QRCodeStyling({
        ...qrStyles[style],
        data: url,
        type: 'svg',
        margin: 0,
        width: 300,
        height: 300,
        backgroundOptions: {
            color: 'transparent'
        },
        image: (cutout == 'none')
            ? undefined
            : (cutout == 'esat') ? '/esat_a.svg' : '/empty.svg',
        imageOptions: {
            margin: 10
        }
    })
    // console.log()
    //add xml declaration
    uri = await (await uri.getRawData('svg')).text()
    if (style == 'white' || style == 'black') {
        // Make the dots smaller
        let doc = new DOMParser().parseFromString(uri, 'image/svg+xml')
        doc.querySelectorAll('circle').forEach(el => {
            let r = Number.parseFloat(el.getAttribute('r'))
            el.setAttribute('r', r * 0.8)
        })
        uri = '<?xml version="1.0" standalone="no"?><svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" xmlns:xlink="http://www.w3.org/1999/xlink">'
            + doc.documentElement.innerHTML + '</svg>'
    }
    //convert svg source to URI data scheme.
    if (encode)
        uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(uri);
    return uri;
}

window.submitCustom = () => {
    let el = document.querySelector('#url_input')
    items.push(new QRItem(null, "-", el.value))
    el.value = null
    updateItems()
}

document.getElementById('upload').addEventListener('change', async (event) => {

    // Clear previous items
    items = []
    errors = []

    for (let i = 0; i < event.target.files.length; i++) {
        // Skip non-images
        if (!/\.(jpg|jpeg|png|gif)$/.test(event.target.files[i].name.toLowerCase()))
            continue
        // Step 1: read the file
        let image = await new Promise((resolve, reject) => {
            var reader = new FileReader();
            reader.addEventListener('load', () => {
                resolve(reader.result)
            })
            reader.onerror = reject
            reader.readAsDataURL(event.target.files[i]);
        })
        // Step 2: scan for qr code
        var qrResult;
        try {
            qrResult = await new Promise((resolve, reject) => {
                var qr = new QRReader();
                qr.callback = (err, value) => {
                    if (err)
                        reject(err);
                    else
                        resolve(value.result)
                }
                qr.decode(image)
            })
        } catch (err) {
            // Append to list of unsuccessful scans
            errors.push(new QRItem(image, event.target.files[i].name, err))
            updateItems()
            continue
        }
        // Step 3: Append to list of successful scans
        items.push(new QRItem(image, event.target.files[i].name, qrResult))
        updateItems()
    }
    updateItems()
})

// Drag and drop highlighting
var drop = document.getElementById("upload");
drop.addEventListener("dragenter", () => {
    drop.classList.add('hovered')
}, false);
drop.addEventListener("dragleave", () => {
    drop.classList.remove('hovered')
}, false);


// Live preview updating
const updateLivePreview = async () => {
    // Get the current style to set the preview background color
    const style = document.querySelector('input[name="style"]:checked').value
    document.querySelector('#qr-preview').classList.toggle('dark', style == 'white')
    // Generate a preview qrcode
    document.querySelector('#qr-preview > img').setAttribute('src', await createURI('https://esat.es', true))
}

document.querySelectorAll('input[type=radio]').forEach(el => el.addEventListener('change', async (event) => {
    sessionStorage.setItem('style', document.querySelector('input[name="style"]:checked').value)
    sessionStorage.setItem('cutout', document.querySelector('input[name="cutout"]:checked').value)
    updateLivePreview()
}))


// Restore state from sessionStorage
document.querySelector(`input[name="style"][value="${sessionStorage.getItem('style')}"]`).checked = true
document.querySelector(`input[name="cutout"][value="${sessionStorage.getItem('cutout')}"]`).checked = true
updateLivePreview()
