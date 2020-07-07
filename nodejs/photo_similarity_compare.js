/**
 * @param {String} dirpath
 */

const path = require('path');
const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const [pathArg1, pathArg2] = process.argv.slice(2);
const pathFrom = path.isAbsolute(pathArg1)
  ? pathArg1
  : path.join(__dirname, pathArg1);
const pathTo = path.isAbsolute(pathArg2)
  ? pathArg2
  : path.join(__dirname, pathArg2);

const compare = async (file1, file2) => {
  const width = 50;
  const height = 50;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  // 缩小到50x50
  function toZoom(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) reject(err);
        const img = new Image();
        img.src = data;
        context.drawImage(img, 0, 0, img.width, img.height, 0, 0, 50, 50);
        const imageData = context.getImageData(0, 0, 50, 50);
        resolve(imageData);
      });
    });
  }

  // 图片灰度化
  function toGray(imageData) {
    const temp = [];
    const { data } = imageData;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114 | 0;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      temp.push(gray);
    }
    context.putImageData(imageData, 0, 0);
    return temp;
  }

  // Otsu's method --> 确定一个阈值
  function toOtsu(grayData) {
    const histData = Array(256).fill(0);
    const total = grayData.length;

    grayData.forEach((color) => {
      const h = 0xFF & color;
      histData[h] += 1;
    });

    let sum = 0;
    for (let i = 0; i < 256; i += 1) {
      sum += i * histData[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 0;

    for (let t = 0; t < 256; t += 1) {
      wB += histData[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;

      sumB += t * histData[t];

      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      // 类间方差
      const varBetween = wB * wF * ((mB - mF) ** 2);

      if (varBetween > varMax) {
        varMax = varBetween;
        threshold = t;
      }
    }
    return threshold;
  }

  // 根据阈值进行二值化
  function toBinary(grayData) {
    const threshold = toOtsu(grayData);
    const imageData = context.createImageData(50, 50);
    const { data } = imageData;
    const temp = [];
    grayData.forEach((v, i) => {
      const gray = v > threshold ? 255 : 0;
      data[i * 4] = gray;
      data[i * 4 + 1] = gray;
      data[i * 4 + 2] = gray;
      data[i * 4 + 3] = 255;
      temp.push(gray > 0 ? 0 : 1);
    });
    context.putImageData(imageData, 0, 0);
    return temp;
  }

  function checkFileExist(filePath) {
    return new Promise((resolve) => {
      fs.stat(filePath, (err, stats) => (stats
        ? resolve(true)
        : resolve(false)));
    });
  }

  async function switchFile(file) {
    try {
      const imageData = await toZoom(file);
      const grayData = toGray(imageData);
      return toBinary(grayData);
    } catch (err) {
      throw err;
    }
  }

  async function onCompare() {
    try {
      if (!file1 || !file2) return 'file path not exist';
      const name1 = path.basename(file1);
      const name2 = path.basename(file2);
      const fileExist1 = await checkFileExist(file1);
      const fileExist2 = await checkFileExist(file2);
      if (fileExist1 && !fileExist2) {
        return `${name1} 与 ${name2}，${file2} not exist`;
      } if (!fileExist1 && fileExist2) {
        return `${name1} 与 ${name2}，${file1} not exist`;
      } if (!fileExist1 && !fileExist2) {
        return `${name1} 与 ${name2}，all file not exist`;
      }
      const switch1 = await switchFile(file1);
      const switch2 = await switchFile(file2);
      let count = 0;
      const total = switch1.length;
      for (let i = 0; i < total; i += 1) {
        count += +!(switch1[i] ^ switch2[i]);
      }
      return `${name1} 与 ${name2} 相似度：${(count / total * 100).toLocaleString()}%`;
    } catch (err) {
      throw err;
    }
  }

  const res = await onCompare();
  return res;
};

fs.readdir(pathFrom, (err, files) => {
  if (err) throw err;
  const stack = files.map(name => compare(
    path.join(pathFrom, name),
    path.join(pathTo, name),
  ));
  Promise
    .all(stack)
    .then((res) => {
      console.log(res);
    });
});
