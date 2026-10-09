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

  carregarPacote({"data":"geral-zz-t2.data","remote_package_size":495537,"files":[{"filename":"/cenario.json","start":0,"end":533},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":533,"end":624},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":624,"end":624},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.dat","start":624,"end":796},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.vsc","start":796,"end":796},{"filename":"/dsk/fi/estatico/scueconf-t2.dat","start":796,"end":874},{"filename":"/dsk/fi/estatico/scueconf-t2.vsc","start":874,"end":874},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":874,"end":2295},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2295,"end":2347},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2347,"end":17000},{"filename":"/dsk/fi/estatico/t02500-cp.dat","start":17000,"end":17165},{"filename":"/dsk/fi/estatico/t02500-cp.pid","start":17165,"end":17211},{"filename":"/dsk/fi/estatico/t02500-cp.vsc","start":17211,"end":36722},{"filename":"/dsk/fi/estatico/t02500zz-mme.dat","start":36722,"end":36749},{"filename":"/dsk/fi/estatico/t02500zz-mme.pid","start":36749,"end":36802},{"filename":"/dsk/fi/estatico/t02500zz-mme.vsc","start":36802,"end":56321},{"filename":"/dsk/fi/estatico/t02500zz-mu.dat","start":56321,"end":56443},{"filename":"/dsk/fi/estatico/t02500zz-mu.vsc","start":56443,"end":56443},{"filename":"/dsk/fi/estatico/t02500zz-mz.dat","start":56443,"end":56502},{"filename":"/dsk/fi/estatico/t02500zz-mz.pid","start":56502,"end":56554},{"filename":"/dsk/fi/estatico/t02500zz-mz.vsc","start":56554,"end":80933},{"filename":"/dsk/fi/estatico/t02500zz-pu.dat","start":80933,"end":82354},{"filename":"/dsk/fi/estatico/t02500zz-pu.pid","start":82354,"end":82406},{"filename":"/dsk/fi/estatico/t02500zz-pu.vsc","start":82406,"end":97059},{"filename":"/dsk/fi/estatico/t02500zz000010001-el.pid","start":97059,"end":97126},{"filename":"/dsk/fi/estatico/t02500zz000010001-el.vsc","start":97126,"end":170332},{"filename":"/dsk/fi/estatico/t02500zz000010001-imp.pid","start":170332,"end":170400},{"filename":"/dsk/fi/estatico/t02500zz000010001-imp.vsc","start":170400,"end":243614},{"filename":"/dsk/fi/estatico/t02500zz000010001-se.dat","start":243614,"end":243764},{"filename":"/dsk/fi/estatico/t02500zz000010001-se.pid","start":243764,"end":243831},{"filename":"/dsk/fi/estatico/t02500zz000010001-se.vsc","start":243831,"end":243831},{"filename":"/dsk/fi/estatico/t02500zz000010001-tte.pid","start":243831,"end":243899},{"filename":"/dsk/fi/estatico/t02500zz000010001-tte.vsc","start":243899,"end":317107},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-el.dat","start":317107,"end":317227},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-el.vsc","start":317227,"end":317227},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-imp.dat","start":317227,"end":317293},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-imp.vsc","start":317293,"end":317293},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-tte.dat","start":317293,"end":317335},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-tte.vsc","start":317335,"end":317335},{"filename":"/dsk/fi/estatico/t02520zz-cfm.dat","start":317335,"end":317589},{"filename":"/dsk/fi/estatico/t02520zz-cfm.vsc","start":317589,"end":317589},{"filename":"/dsk/fi/estatico/t02520zz-cm.dat","start":317589,"end":317663},{"filename":"/dsk/fi/estatico/t02520zz-cm.pid","start":317663,"end":317715},{"filename":"/dsk/fi/estatico/t02520zz-cm.vsc","start":317715,"end":337231},{"filename":"/dsk/fi/estatico/t02520zz-ste.dat","start":337231,"end":337276},{"filename":"/dsk/fi/estatico/t02520zz-ste.pid","start":337276,"end":337329},{"filename":"/dsk/fi/estatico/t02520zz-ste.vsc","start":337329,"end":361713},{"filename":"/dsk/fi/estatico/t02521br00000-ca.dat","start":361713,"end":361992},{"filename":"/dsk/fi/estatico/t02521br00000-ca.pid","start":361992,"end":362049},{"filename":"/dsk/fi/estatico/t02521br00000-ca.vsc","start":362049,"end":410792},{"filename":"/dsk/fi/estatico/t02521br00000-co.dat","start":410792,"end":410824},{"filename":"/dsk/fi/estatico/t02521br00000-co.vsc","start":410824,"end":410824},{"filename":"/dsk/fi/estatico/t02521br00000-fe.dat","start":410824,"end":410849},{"filename":"/dsk/fi/estatico/t02521br00000-fe.vsc","start":410849,"end":410849},{"filename":"/dsk/fi/estatico/t02521br00000-fo.dat","start":410849,"end":455940},{"filename":"/dsk/fi/estatico/t02521br00000-fo.pid","start":455940,"end":455997},{"filename":"/dsk/fi/estatico/t02521br00000-fo.vsc","start":455997,"end":475531},{"filename":"/dsk/fi/estatico/t02521br00000-le.dat","start":475531,"end":475563},{"filename":"/dsk/fi/estatico/t02521br00000-le.vsc","start":475563,"end":475563},{"filename":"/dsk/fi/estatico/t02521br00000-pa.dat","start":475563,"end":475668},{"filename":"/dsk/fi/estatico/t02521br00000-pa.vsc","start":475668,"end":475668},{"filename":"/dsk/fi/estatico/t02521br00000-pi.dat","start":475668,"end":475695},{"filename":"/dsk/fi/estatico/t02521br00000-pi.vsc","start":475695,"end":475695},{"filename":"/dsk/fi/estatico/t02521br00000-rdj.dat","start":475695,"end":475724},{"filename":"/dsk/fi/estatico/t02521br00000-rdj.vsc","start":475724,"end":475724},{"filename":"/dsk/fi/estatico/t02521zz-ce.dat","start":475724,"end":475960},{"filename":"/dsk/fi/estatico/t02521zz-ce.pid","start":475960,"end":476012},{"filename":"/dsk/fi/estatico/t02521zz-ce.vsc","start":476012,"end":495529},{"filename":"/dsk/fi/serialv.dat","start":495529,"end":495537}]});
})();
