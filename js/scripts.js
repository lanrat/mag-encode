
const peak = 32767; //  maximum value of a 16-bit signed integer.

// default values
var config = {
    padding: 25, // magstripe leading & trailing 0s
    frequency: 32, // Samples per bit, recommended [5-45] (was 15)
    reverse_swipe: true,
    reverse: false,
};

document.getElementById("padding").value = config.padding;
document.getElementById("frequency").value = config.frequency;
document.getElementById("frequency").nextElementSibling.value = config.frequency;
document.getElementById("reverse_swipe").checked = config.reverse_swipe;
document.getElementById("reverse").checked = config.reverse;

function test() {
    var t1 = test10();
    document.getElementById("binary_data").innerText = t1;
}

function test10() {
    var input = "%B4929555123456789^MALFUNCTION/MAJOR ^0902201010000000000000970000000?";
    var expected = "0000000000000000000000000101000101000110010101100110001001011001100101010010101001010100100010101001011100100001010110101000110100111010100011011001100011111010110111000011001101001100101010111011101111000100010110100101011110100111011111100110110111000011010101011110100100110000000101111100000100100110000001000100101010010100001001000101000010010001010000100000010000001000000100000010000001000000100000010000001000000100000010000001000000100100110011101010000100000010000001000000100000010000001000000100111110011011100000000000000000000000000";
    var out = encodeMag(input);
    return out == expected;
}

function encodeData() {
    // get settings
    config.padding = document.getElementById("padding").value;
    config.frequency = document.getElementById("frequency").value;
    config.reverse_swipe = document.getElementById("reverse_swipe").checked;
    config.reverse = document.getElementById("reverse").checked;

    console.log("config:", config);

    // get data
    var data = document.getElementById("magstripe").value;
    console.log("input data: ", data);
    var bin = encodeMag(data);


    console.log("binary data: ", bin);
    document.getElementById("binary_data").innerText = bin;
    var wav = generateWav(bin);

    console.log("wav byteLength: ", wav.byteLength);

    // var enc = new TextDecoder("utf-8");
    // var wav_str = enc.decode(wav);
    // console.log("wav: ", wav_str);
    // document.getElementById("wav_data").innerText = wav_str;

    // var hex = hexdump(wav, 16);
    // console.log("hex");
    // console.log(hex);

    return wav;
}

function encodeButton() {
    var wav = encodeData();
    playWave(wav);
}

function downloadButton() {
    var wav = encodeData();
    download("data.wav", wav);
}

function download(filename, data) {
    var urlCreator = window.URL || window.webkitURL;
    var blob = new Blob([data]);
    var url = urlCreator.createObjectURL(blob);

    var element = document.createElement('a');
    element.setAttribute('download', filename);
    element.setAttribute('href', url);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }

function encodeMag(d1) {
    var lrc = [];
    var output = '';

    var bits = 7;
    var base = 32;
    var max = 63;

    changeTrack = function(t) {
        bits = 7;
        base = 32;
        max = 63;
        if (t == 2 || t == 3) {
            bits = 5
            base = 48;
            max = 15;
        }
    }
    
    // track changing
    if (d1[0] == '%') {
        console.log("using track 1 encoding");
        changeTrack(1)
    } else {
        console.log("using track 2 encoding");
        changeTrack(2)
    }

    for (var i = 0; i < bits; i++) {
        lrc.push(0);
    }

    // add padding
    for (var i = 0; i < config.padding; i++) {
        output += '0'
    }

    var parity = 0;
    for (let c of d1) {
        //console.log("char: ", c, ", charcode:", c.charCodeAt(0));
        var raw = c.charCodeAt(0) - base;
        //console.log("raw:", raw);
        if (raw < 0 || raw > max) {
            console.error("Illegal character:", String.fromCharCode(raw + base));
            return;
        }

        parity = 1;
        for (var y = 0; y < bits-1; y++) {
            //console.log("adding Str:", String(raw >> y & 1));
            output += String(raw >> y & 1);
            parity += raw >> y & 1;
            lrc[y] = lrc[y] ^ (raw >> y & 1)
        }

        output += String.fromCharCode((parity % 2)+ '0'.charCodeAt(0));
    }

    parity = 1;
    // add parity bits
    for (var x = 0; x < bits-1; x++) {
        output += String.fromCharCode(lrc[x] + '0'.charCodeAt(0));
        parity += lrc[x]
    }

    // add padding
    output += String.fromCharCode((parity % 2)+ '0'.charCodeAt(0));
    for (var x = 0; x < config.padding; x++) {
        output += '0'
    }

    if (config.reverse) {
        output = reverseString(output);
    }

    return output;
}

// program to reverse a string
function reverseString(str) {
    // empty string
    let newString = "";
    for (let i = str.length - 1; i >= 0; i--) {
        newString += str[i];
    }
    return newString;
}

function generateWav(data) {
    var wave_data = [];

    var encode = function(data) {
        var writedata = peak;
        for (const b of data) {
            if (b == '1') {
                for (var x = 0; x < 2; x++) {
                    writedata = -writedata;
                    for (var y = 0; y < (config.frequency / 4); y++) {
                        wave_data.push(writedata);
                    }
                }
            }else { // b == '0'
                writedata = -writedata;
                for (var y = 0; y < (config.frequency / 2); y++) {
                    wave_data.push(writedata);
                }
            }
        }
    };

    encode(data);

    // TODO support multiple tracks in place of reverse

    // TODO check that the card ends in a ';' to allow adding reverse
    if (config.reverse_swipe) {
        console.log("edding reverse encoding");
        var reverseData = reverseString(data);
        encode(reverseData);
    }

    var data_buffer = new Int16Array(wave_data);

    // set wave header
    wav_opts = {
        numFrames: wave_data.length,
        numChannels: 1,
        sampleRate: 22050,
        bytesPerSample: 2,
    };
    var wavHdr = buildWaveHeader(wav_opts);
    var merged = appendArrayBuffers(wavHdr, data_buffer.buffer)
    return merged;
}

// https://gist.github.com/72lions/4528834
function appendArrayBuffers(buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}


function playWave(wave) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    var audioCtx = new AudioContext();
   audioCtx.decodeAudioData(wave).then(buffer => {
        var track = audioCtx.createBufferSource();
        track.buffer = buffer;
        track.connect(audioCtx.destination);
        track.start(0);
   });

}


// https://gist.github.com/also/900023
function buildWaveHeader(opts) {
    var numFrames = opts.numFrames;
    var numChannels = opts.numChannels || 2;
    var sampleRate = opts.sampleRate || 44100;
    var bytesPerSample = opts.bytesPerSample || 2;
    var blockAlign = numChannels * bytesPerSample;
    var byteRate = sampleRate * blockAlign;
    var dataSize = numFrames * blockAlign;

    var buffer = new ArrayBuffer(44);
    var dv = new DataView(buffer);

    var p = 0;

    function writeString(s) {
        for (var i = 0; i < s.length; i++) {
            dv.setUint8(p + i, s.charCodeAt(i));
        }
        p += s.length;
    }

    function writeUint32(d) {
        dv.setUint32(p, d, true);
        p += 4;
    }

    function writeUint16(d) {
        dv.setUint16(p, d, true);
        p += 2;
    }

    writeString('RIFF');              // ChunkID
    writeUint32(dataSize + 36);       // ChunkSize
    writeString('WAVE');              // Format
    writeString('fmt ');              // Subchunk1ID
    writeUint32(16);                  // Subchunk1Size
    writeUint16(1);                   // AudioFormat
    writeUint16(numChannels);         // NumChannels
    writeUint32(sampleRate);          // SampleRate
    writeUint32(byteRate);            // ByteRate
    writeUint16(blockAlign);          // BlockAlign
    writeUint16(bytesPerSample * 8);  // BitsPerSample
    writeString('data');              // Subchunk2ID
    writeUint32(dataSize);            // Subchunk2Size

    return buffer;
}

function hexdump(buffer, blockSize) {
	
	if(typeof buffer === 'string'){
		console.log("hex: buffer is string");
		//do nothing
	}else if(buffer instanceof ArrayBuffer && buffer.byteLength !== undefined){
		console.log("hex: buffer is ArrayBuffer");
		buffer = String.fromCharCode.apply(String, [].slice.call(new Uint8Array(buffer)));
	}else if(Array.isArray(buffer)){
		console.log("hex: buffer is Array");
		buffer = String.fromCharCode.apply(String, buffer);
	}else if (buffer.constructor === Uint8Array) {
		console.log("hex: buffer is Uint8Array");
		buffer = String.fromCharCode.apply(String, [].slice.call(buffer));
	}else{
		console.log("hex: Error: buffer is unknown...");
		return false;
	}
	
    
	blockSize = blockSize || 16;
    var lines = [];
    var hex = "0123456789ABCDEF";
    for (var b = 0; b < buffer.length; b += blockSize) {
        var block = buffer.slice(b, Math.min(b + blockSize, buffer.length));
        var addr = ("0000" + b.toString(16)).slice(-4);
        var codes = block.split('').map(function (ch) {
            var code = ch.charCodeAt(0);
            return " " + hex[(0xF0 & code) >> 4] + hex[0x0F & code];
        }).join("");
        codes += "   ".repeat(blockSize - block.length);
        var chars = block.replace(/[\x00-\x1F\x20]/g, '.');
        chars +=  " ".repeat(blockSize - block.length);
        lines.push(addr + " " + codes + "  " + chars);
    }
    return lines.join("\n");
}