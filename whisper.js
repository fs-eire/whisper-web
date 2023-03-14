
let sess;

// web audio context
var context = null;

// audio data
var audio = null;


let mediaRecorder;

const kSampleRate = 16000;
const kRestartRecording_s = 120;
const kIntervalAudio_ms = 250; // pass the recorded audio to the C++ instance at this rate


async function init() {
    sess = await ort.InferenceSession.create('./model.onnx');
};

async function startRecord() {

    try {
        if (!context) {
            log(`AudioContext not created yet. create new instance of AudioContext {sampleRate=${kSampleRate}, channelCount=${1}}`);
            context = new AudioContext({
                sampleRate: kSampleRate,
                channelCount: 1,
                echoCancellation: false,
                autoGainControl:  true,
                noiseSuppression: true,
            });
        }
        log('AudioContext is ready. getting media stream...');

        const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
        log('MediaStream is ready.');

        const chunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
            log(`data pushed... chunk count = ${chunks.length}`);
            chunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
            log('MediaStream is stopping...');
            const blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
            const reader = new FileReader();
            reader.onload = (() => {
                const buffer = new Uint8Array(reader.result);
                log(`Chunks loaded ${buffer.byteLength} bytes. Decoding...`);
                
                context.decodeAudioData(buffer.buffer, function(audioBuffer) {
                    var offlineContext = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length, audioBuffer.sampleRate);
                    var source = offlineContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(offlineContext.destination);
                    source.start(0);

                    offlineContext.startRendering().then(function(renderedBuffer) {
                        audio = renderedBuffer.getChannelData(0);

                        log(`raw audio data rendered... ${audio.byteLength} bytes`);

                        log(`TODO: ready to send this Float32Array of length(${audio.length}) as input to ORT`);
                        // TODO: kick ORT inference run here
                    });
                }, function(e) {
                    audio = null;
                    log(`ERR: ${e}`);
                });
            });

            reader.readAsArrayBuffer(blob);
            log('Reading chunks...');

            const audioElement = document.createElement("audio");
            audioElement.controls = true;
            const audioURL = window.URL.createObjectURL(blob);
            audioElement.src = audioURL;
            document.getElementById('record_play').replaceChildren(audioElement);
        };
        mediaRecorder.start(kIntervalAudio_ms);

    } catch (e) {
        log(`ERR: ${e}`);
    }
};

function stopRecord() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder = undefined;
    }
};

