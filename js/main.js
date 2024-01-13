const canvas = document.getElementById('Canvas');
const context = canvas.getContext('2d');

const FPS = 60;
const log2DataSize = 8;
const dataSize = 2 ** log2DataSize;
const skipData = 40;
var waveData;
var duration;
var time = performance.now();

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const audioPlayer = document.getElementById('audioPlayer');

function disableScroll() {
  document.body.style.overflow = 'hidden';
};

disableScroll();

function init() {
  const input = document.getElementById('fileInput');
  input.addEventListener('change', (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      audioPlayer.src = URL.createObjectURL(file);;
      const audioContext = new AudioContext();

      let decodeFunction;
      switch (file.type) {
        case 'audio/wav':
          decodeFunction = audioContext.decodeAudioData;
          break;
        case 'audio/mp3':
        case 'audio/mpeg':
        case 'audio/m4a':
          decodeFunction = audioContext.decodeAudioData.bind(audioContext, event.target.result);
          break;
        case 'audio/ogg':
          decodeFunction = audioContext.decodeAudioData.bind(audioContext, event.target.result);
          break;
        default:
          throw new Error(`Unsupported file type: ${file.type}`);
      }

      decodeFunction((buffer) => {
        const channelData = buffer.getChannelData(0);
        duration = buffer.duration;
        let audioData = [];
        for (let i = 0; i < channelData.length; i ++) {
          audioData.push(channelData[i]);
        }
        waveData = audioData;
      });
      
    }
    reader.readAsArrayBuffer(file);
  });
};

function lowpass(audioData, number) {
  let value = 0;
  for (let i = 0; i < 15; i++) {
    value += audioData[number + 2 * i];
    value += audioData[number - 2 * i];
  }
  return value / 30;
}

function setData(audioData, time, audioLength) {
  let data = [];
  let now = Math.trunc(time * audioData.length / audioLength + 0.5);
  for (let i = 0; i < dataSize; i++) {
    data.push(windowFunction(i / (dataSize - 1)) * lowpass(audioData, Math.trunc(now + i * skipData)));
  }
  return data;
}

function windowFunction(x) {
  return 0.42 - 0.5 * Math.cos(2 * Math.PI * x) + 0.08 * Math.cos(4 * Math.PI * x);
}

function reverseBit(num, b) {
  let tmp = num;
  let res = tmp & 1;
  for (let i = 1; i < b; i++) {
      tmp >>= 1;
      res = (res << 1) | (tmp & 1);
  }
  return res;
}

var reverseBitArray = [];
function getReverseBitArray() {
  for (let i = 0; i < dataSize; i++) {
    reverseBitArray.push(reverseBit(i, Math.trunc(Math.log(dataSize) / Math.log(2) + 0.5)));
  }
}

var wiRList = [];
var wiIList = [];
var wkRList = [];
var wkIList = [];
function makeWList() {
  let windowSize = 1;
  while (windowSize < dataSize) {
    windowSize *= 2;
    let _wiRList = [];
    let _wiIList = [];
    let _wkRList = [];
    let _wkIList = [];
    for (let i = 0; i < dataSize; i++) {
      if (i % windowSize < windowSize / 2) {
        let k = i + windowSize / 2;
        _wiRList.push(Math.cos(-2 * Math.PI * (i % windowSize) / windowSize));
        _wiIList.push(Math.sin(-2 * Math.PI * (i % windowSize) / windowSize));
        _wkRList.push(Math.cos(-2 * Math.PI * (k % windowSize) / windowSize));
        _wkIList.push(Math.sin(-2 * Math.PI * (k % windowSize) / windowSize));
      }
    }
    wiRList.push(_wiRList);
    wiIList.push(_wiIList);
    wkRList.push(_wkRList);
    wkIList.push(_wkIList);
  }
}

function FFT(data) {
  let Fi = Array(data.length).fill(0);
  let Fr = [];
  for (let i = 0; i < data.length; i++) {
    Fr.push(data[reverseBitArray[i]]);
  }
  let windowSize = 1;
  let j = 0;
  while (windowSize < data.length) {
    windowSize *= 2;
    let l = 0;
    for (let i = 0; i < data.length; i++) {
      if (i % windowSize < windowSize / 2) {
        let k = i + windowSize / 2;
        let wiR = wiRList[j][l];
        let wiI = wiIList[j][l];
        let wkR = wkRList[j][l];
        let wkI = wkIList[j][l];
        l += 1;
        [Fr[i], Fi[i], Fr[k], Fi[k]] = [Fr[i] + wiR * Fr[k] - wiI * Fi[k], Fi[i] + wiI * Fr[k] + wiR * Fi[k], Fr[i] + wkR * Fr[k] - wkI * Fi[k], Fi[i] + wkI * Fr[k] + wkR * Fi[k]];
      }
    }
    j += 1;
  }
  return [Fr, Fi];
}

function getSpectrum(data) {
  let F = FFT(data);
  let spectrum = [];
  for (let i = 0; i < data.length; i++) {
    spectrum.push((F[0][i] ** 2 + F[1][i] ** 2) ** 0.5 * 8);
  }
  return spectrum;
}

function draw(data) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "Blue";
  context.lineWidth = 2;
  let spectrum = getSpectrum(data);
  context.beginPath();
  for (let i = 0; i < data.length / 2; i++) {
    context.moveTo(canvas.width / 2 + (i / (data.length / 2 - 1)) * canvas.width * (1 / 2)  - canvas.width / 4, canvas.height / 2 + 102);
    context.lineTo(canvas.width / 2 + (i / (data.length / 2 - 1)) * canvas.width * (1 / 2) - canvas.width / 4, canvas.height / 2 + 100 - spectrum[i]);
  }
  context.stroke();
}

function draw2(data, time, audioLength) {
  let now = Math.trunc(time * data.length / audioLength + 0.5);
  context.strokeStyle = "Black";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(canvas.width / 2 - canvas.width / 4, canvas.height / 2 - 200 - data[Math.trunc(now)] * 100);
  for (let i = 0; i < dataSize; i++) {
    context.lineTo(canvas.width / 2 + (i / (dataSize - 1)) * canvas.width * (1 / 2) - canvas.width / 4, canvas.height / 2 - 200 - data[Math.trunc(now + i * skipData / 10)] * 100);
  }
  context.stroke();
}

let intervalId;

function startInterval() {
  intervalId = setInterval(() => {
    draw(setData(waveData, audioPlayer.currentTime, duration));
    draw2(waveData, audioPlayer.currentTime, duration);
  }, 1000 / FPS);
}

function stopInterval() {
  clearInterval(intervalId);
}

document.addEventListener('DOMContentLoaded', (event) => {
  const play = document.getElementById('play');
  const stop = document.getElementById('stop');

  play.addEventListener('click', () => {
    if (waveData.length > 0) {
      reverseBitArray = [];
      getReverseBitArray();
      makeWList();
      audioPlayer.play();
      time = performance.now()
      startInterval();
    } else {
      alert('Please upload an audio file first.');
    }
  });

  stop.addEventListener('click', () => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    stopInterval();
  });
});
