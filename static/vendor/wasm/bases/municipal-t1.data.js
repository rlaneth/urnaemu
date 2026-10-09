var Module = typeof Module != 'undefined' ? Module : {};

if (!Module['expectedDataFileDownloads']) Module['expectedDataFileDownloads'] = 0;
Module['expectedDataFileDownloads']++;

(function() {
  async function carregarPacote(metadata) {
    var nomePacote = metadata['data'];
    var nomeRemoto = Module['locateFile'] ? Module['locateFile'](nomePacote, '') : nomePacote;
    var dependencia = 'datafile_' + nomePacote;

    function criarDiretorios(arquivo) {
      var partes = arquivo.split('/').filter(Boolean);
      var atual = '/';
      for (var indice = 0; indice < partes.length - 1; ++indice) {
        try {
          Module['FS_createPath'](atual, partes[indice], true, true);
        } catch (_) {
          // O diretorio pode ja existir quando varios arquivos compartilham o mesmo caminho.
        }
        atual += (atual === '/' ? '' : '/') + partes[indice];
      }
    }

    function montarArquivos(arrayBuffer) {
      var bytes = new Uint8Array(arrayBuffer);
      for (var arquivo of metadata['files']) {
        criarDiretorios(arquivo['filename']);
        Module['FS_createDataFile'](
          arquivo['filename'],
          null,
          bytes.subarray(arquivo['start'], arquivo['end']),
          true,
          true,
          true
        );
      }
      if (!Module['preloadResults']) Module['preloadResults'] = {};
      Module['preloadResults'][nomePacote] = {fromCache: false};
    }

    Module['addRunDependency'] && Module['addRunDependency'](dependencia);
    try {
      var resposta = await fetch(nomeRemoto);
      if (!resposta.ok) {
        throw new Error(resposta.status + ': ' + resposta.url);
      }
      montarArquivos(await resposta.arrayBuffer());
      Module['removeRunDependency'] && Module['removeRunDependency'](dependencia);
    } catch (erro) {
      console.error('Falha ao carregar pacote de dados ' + nomeRemoto, erro);
      throw erro;
    }
  }

  carregarPacote({"data":"municipal-t1.data","remote_package_size":782119,"files":[{"filename":"/cenario.json","start":0,"end":534},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":534,"end":621},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":621,"end":621},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.dat","start":621,"end":793},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.vsc","start":793,"end":793},{"filename":"/dsk/fi/estatico/scueconf-t1.dat","start":793,"end":871},{"filename":"/dsk/fi/estatico/scueconf-t1.vsc","start":871,"end":871},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":871,"end":2292},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2292,"end":2344},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2344,"end":16997},{"filename":"/dsk/fi/estatico/t02400-cp.dat","start":16997,"end":17166},{"filename":"/dsk/fi/estatico/t02400-cp.pid","start":17166,"end":17212},{"filename":"/dsk/fi/estatico/t02400-cp.vsc","start":17212,"end":36723},{"filename":"/dsk/fi/estatico/t02400ac-mme.dat","start":36723,"end":36750},{"filename":"/dsk/fi/estatico/t02400ac-mme.pid","start":36750,"end":36803},{"filename":"/dsk/fi/estatico/t02400ac-mme.vsc","start":36803,"end":56322},{"filename":"/dsk/fi/estatico/t02400ac-mu.dat","start":56322,"end":56440},{"filename":"/dsk/fi/estatico/t02400ac-mu.vsc","start":56440,"end":56440},{"filename":"/dsk/fi/estatico/t02400ac-mz.dat","start":56440,"end":56499},{"filename":"/dsk/fi/estatico/t02400ac-mz.pid","start":56499,"end":56551},{"filename":"/dsk/fi/estatico/t02400ac-mz.vsc","start":56551,"end":80930},{"filename":"/dsk/fi/estatico/t02400ac-pu.dat","start":80930,"end":82351},{"filename":"/dsk/fi/estatico/t02400ac-pu.pid","start":82351,"end":82403},{"filename":"/dsk/fi/estatico/t02400ac-pu.vsc","start":82403,"end":97056},{"filename":"/dsk/fi/estatico/t02400ac000010001-el.pid","start":97056,"end":97123},{"filename":"/dsk/fi/estatico/t02400ac000010001-el.vsc","start":97123,"end":170329},{"filename":"/dsk/fi/estatico/t02400ac000010001-imp.pid","start":170329,"end":170397},{"filename":"/dsk/fi/estatico/t02400ac000010001-imp.vsc","start":170397,"end":243611},{"filename":"/dsk/fi/estatico/t02400ac000010001-se.dat","start":243611,"end":243761},{"filename":"/dsk/fi/estatico/t02400ac000010001-se.pid","start":243761,"end":243828},{"filename":"/dsk/fi/estatico/t02400ac000010001-se.vsc","start":243828,"end":243828},{"filename":"/dsk/fi/estatico/t02400ac000010001-tte.pid","start":243828,"end":243896},{"filename":"/dsk/fi/estatico/t02400ac000010001-tte.vsc","start":243896,"end":317104},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-el.dat","start":317104,"end":317241},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-el.vsc","start":317241,"end":317241},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-imp.dat","start":317241,"end":317307},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-imp.vsc","start":317307,"end":317307},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-tte.dat","start":317307,"end":317349},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-tte.vsc","start":317349,"end":317349},{"filename":"/dsk/fi/estatico/t02410ac-cfm.dat","start":317349,"end":317603},{"filename":"/dsk/fi/estatico/t02410ac-cfm.vsc","start":317603,"end":317603},{"filename":"/dsk/fi/estatico/t02410ac-cm.dat","start":317603,"end":317677},{"filename":"/dsk/fi/estatico/t02410ac-cm.pid","start":317677,"end":317729},{"filename":"/dsk/fi/estatico/t02410ac-cm.vsc","start":317729,"end":337245},{"filename":"/dsk/fi/estatico/t02410ac-ste.dat","start":337245,"end":337290},{"filename":"/dsk/fi/estatico/t02410ac-ste.pid","start":337290,"end":337343},{"filename":"/dsk/fi/estatico/t02410ac-ste.vsc","start":337343,"end":361727},{"filename":"/dsk/fi/estatico/t02411ac-ce.dat","start":361727,"end":362032},{"filename":"/dsk/fi/estatico/t02411ac-ce.pid","start":362032,"end":362084},{"filename":"/dsk/fi/estatico/t02411ac-ce.vsc","start":362084,"end":381601},{"filename":"/dsk/fi/estatico/t02411ac00001-ca.dat","start":381601,"end":383305},{"filename":"/dsk/fi/estatico/t02411ac00001-ca.pid","start":383305,"end":383365},{"filename":"/dsk/fi/estatico/t02411ac00001-ca.vsc","start":383365,"end":432109},{"filename":"/dsk/fi/estatico/t02411ac00001-co.dat","start":432109,"end":432150},{"filename":"/dsk/fi/estatico/t02411ac00001-co.vsc","start":432150,"end":432150},{"filename":"/dsk/fi/estatico/t02411ac00001-fe.dat","start":432150,"end":432175},{"filename":"/dsk/fi/estatico/t02411ac00001-fe.vsc","start":432175,"end":432175},{"filename":"/dsk/fi/estatico/t02411ac00001-fo.dat","start":432175,"end":762193},{"filename":"/dsk/fi/estatico/t02411ac00001-fo.pid","start":762193,"end":762253},{"filename":"/dsk/fi/estatico/t02411ac00001-fo.vsc","start":762253,"end":781787},{"filename":"/dsk/fi/estatico/t02411ac00001-le.dat","start":781787,"end":781828},{"filename":"/dsk/fi/estatico/t02411ac00001-le.vsc","start":781828,"end":781828},{"filename":"/dsk/fi/estatico/t02411ac00001-pa.dat","start":781828,"end":782055},{"filename":"/dsk/fi/estatico/t02411ac00001-pa.vsc","start":782055,"end":782055},{"filename":"/dsk/fi/estatico/t02411ac00001-pi.dat","start":782055,"end":782082},{"filename":"/dsk/fi/estatico/t02411ac00001-pi.vsc","start":782082,"end":782082},{"filename":"/dsk/fi/estatico/t02411ac00001-rdj.dat","start":782082,"end":782111},{"filename":"/dsk/fi/estatico/t02411ac00001-rdj.vsc","start":782111,"end":782111},{"filename":"/dsk/fi/serialv.dat","start":782111,"end":782119}]});
})();
