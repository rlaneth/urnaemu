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

  carregarPacote({"data":"municipal-t2.data","remote_package_size":492278,"files":[{"filename":"/cenario.json","start":0,"end":534},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":534,"end":621},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":621,"end":621},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.dat","start":621,"end":793},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.vsc","start":793,"end":793},{"filename":"/dsk/fi/estatico/scueconf-t2.dat","start":793,"end":871},{"filename":"/dsk/fi/estatico/scueconf-t2.vsc","start":871,"end":871},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":871,"end":2292},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2292,"end":2344},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2344,"end":16997},{"filename":"/dsk/fi/estatico/t02400-cp.dat","start":16997,"end":17166},{"filename":"/dsk/fi/estatico/t02400-cp.pid","start":17166,"end":17212},{"filename":"/dsk/fi/estatico/t02400-cp.vsc","start":17212,"end":36723},{"filename":"/dsk/fi/estatico/t02400ac-mme.dat","start":36723,"end":36750},{"filename":"/dsk/fi/estatico/t02400ac-mme.pid","start":36750,"end":36803},{"filename":"/dsk/fi/estatico/t02400ac-mme.vsc","start":36803,"end":56322},{"filename":"/dsk/fi/estatico/t02400ac-mu.dat","start":56322,"end":56440},{"filename":"/dsk/fi/estatico/t02400ac-mu.vsc","start":56440,"end":56440},{"filename":"/dsk/fi/estatico/t02400ac-mz.dat","start":56440,"end":56499},{"filename":"/dsk/fi/estatico/t02400ac-mz.pid","start":56499,"end":56551},{"filename":"/dsk/fi/estatico/t02400ac-mz.vsc","start":56551,"end":80930},{"filename":"/dsk/fi/estatico/t02400ac-pu.dat","start":80930,"end":82351},{"filename":"/dsk/fi/estatico/t02400ac-pu.pid","start":82351,"end":82403},{"filename":"/dsk/fi/estatico/t02400ac-pu.vsc","start":82403,"end":97056},{"filename":"/dsk/fi/estatico/t02400ac000010001-el.pid","start":97056,"end":97123},{"filename":"/dsk/fi/estatico/t02400ac000010001-el.vsc","start":97123,"end":170329},{"filename":"/dsk/fi/estatico/t02400ac000010001-imp.pid","start":170329,"end":170397},{"filename":"/dsk/fi/estatico/t02400ac000010001-imp.vsc","start":170397,"end":243611},{"filename":"/dsk/fi/estatico/t02400ac000010001-se.dat","start":243611,"end":243761},{"filename":"/dsk/fi/estatico/t02400ac000010001-se.pid","start":243761,"end":243828},{"filename":"/dsk/fi/estatico/t02400ac000010001-se.vsc","start":243828,"end":243828},{"filename":"/dsk/fi/estatico/t02400ac000010001-tte.pid","start":243828,"end":243896},{"filename":"/dsk/fi/estatico/t02400ac000010001-tte.vsc","start":243896,"end":317104},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-el.dat","start":317104,"end":317224},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-el.vsc","start":317224,"end":317224},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-imp.dat","start":317224,"end":317290},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-imp.vsc","start":317290,"end":317290},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-tte.dat","start":317290,"end":317332},{"filename":"/dsk/fi/estatico/t02400ac0000100010001-tte.vsc","start":317332,"end":317332},{"filename":"/dsk/fi/estatico/t02420ac-cfm.dat","start":317332,"end":317586},{"filename":"/dsk/fi/estatico/t02420ac-cfm.vsc","start":317586,"end":317586},{"filename":"/dsk/fi/estatico/t02420ac-cm.dat","start":317586,"end":317660},{"filename":"/dsk/fi/estatico/t02420ac-cm.pid","start":317660,"end":317712},{"filename":"/dsk/fi/estatico/t02420ac-cm.vsc","start":317712,"end":337228},{"filename":"/dsk/fi/estatico/t02420ac-ste.dat","start":337228,"end":337273},{"filename":"/dsk/fi/estatico/t02420ac-ste.pid","start":337273,"end":337326},{"filename":"/dsk/fi/estatico/t02420ac-ste.vsc","start":337326,"end":361710},{"filename":"/dsk/fi/estatico/t02421ac-ce.dat","start":361710,"end":361936},{"filename":"/dsk/fi/estatico/t02421ac-ce.pid","start":361936,"end":361988},{"filename":"/dsk/fi/estatico/t02421ac-ce.vsc","start":361988,"end":381505},{"filename":"/dsk/fi/estatico/t02421ac00001-ca.dat","start":381505,"end":381793},{"filename":"/dsk/fi/estatico/t02421ac00001-ca.pid","start":381793,"end":381853},{"filename":"/dsk/fi/estatico/t02421ac00001-ca.vsc","start":381853,"end":430596},{"filename":"/dsk/fi/estatico/t02421ac00001-co.dat","start":430596,"end":430637},{"filename":"/dsk/fi/estatico/t02421ac00001-co.vsc","start":430637,"end":430637},{"filename":"/dsk/fi/estatico/t02421ac00001-fe.dat","start":430637,"end":430662},{"filename":"/dsk/fi/estatico/t02421ac00001-fe.vsc","start":430662,"end":430662},{"filename":"/dsk/fi/estatico/t02421ac00001-fo.dat","start":430662,"end":472465},{"filename":"/dsk/fi/estatico/t02421ac00001-fo.pid","start":472465,"end":472525},{"filename":"/dsk/fi/estatico/t02421ac00001-fo.vsc","start":472525,"end":492059},{"filename":"/dsk/fi/estatico/t02421ac00001-le.dat","start":492059,"end":492100},{"filename":"/dsk/fi/estatico/t02421ac00001-le.vsc","start":492100,"end":492100},{"filename":"/dsk/fi/estatico/t02421ac00001-pa.dat","start":492100,"end":492214},{"filename":"/dsk/fi/estatico/t02421ac00001-pa.vsc","start":492214,"end":492214},{"filename":"/dsk/fi/estatico/t02421ac00001-pi.dat","start":492214,"end":492241},{"filename":"/dsk/fi/estatico/t02421ac00001-pi.vsc","start":492241,"end":492241},{"filename":"/dsk/fi/estatico/t02421ac00001-rdj.dat","start":492241,"end":492270},{"filename":"/dsk/fi/estatico/t02421ac00001-rdj.vsc","start":492270,"end":492270},{"filename":"/dsk/fi/serialv.dat","start":492270,"end":492278}]});
})();
