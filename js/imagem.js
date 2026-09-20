// ========== IMAGEM: redimensiona no canvas e converte para base64 ==========
var Imagem = {
  redimensionar: function (file, maxLado, qualidade) {
    maxLado = maxLado || 1600;
    qualidade = qualidade || 0.8;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          if (blob) resolve(blob); else reject(new Error('Falha ao converter imagem'));
        }, 'image/jpeg', qualidade);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Imagem inválida: ' + (file.name || ''))); };
      img.src = url;
    });
  },

  blobParaBase64: function (blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
};
