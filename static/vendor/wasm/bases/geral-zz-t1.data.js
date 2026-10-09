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

  carregarPacote({"data":"geral-zz-t1.data","remote_package_size":564650,"files":[{"filename":"/cenario.json","start":0,"end":533},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":533,"end":624},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":624,"end":624},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.dat","start":624,"end":796},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.vsc","start":796,"end":796},{"filename":"/dsk/fi/estatico/scueconf-t1.dat","start":796,"end":874},{"filename":"/dsk/fi/estatico/scueconf-t1.vsc","start":874,"end":874},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":874,"end":2295},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2295,"end":2347},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2347,"end":17000},{"filename":"/dsk/fi/estatico/t02500-cp.dat","start":17000,"end":17165},{"filename":"/dsk/fi/estatico/t02500-cp.pid","start":17165,"end":17211},{"filename":"/dsk/fi/estatico/t02500-cp.vsc","start":17211,"end":36722},{"filename":"/dsk/fi/estatico/t02500zz-mme.dat","start":36722,"end":36749},{"filename":"/dsk/fi/estatico/t02500zz-mme.pid","start":36749,"end":36802},{"filename":"/dsk/fi/estatico/t02500zz-mme.vsc","start":36802,"end":56321},{"filename":"/dsk/fi/estatico/t02500zz-mu.dat","start":56321,"end":56443},{"filename":"/dsk/fi/estatico/t02500zz-mu.vsc","start":56443,"end":56443},{"filename":"/dsk/fi/estatico/t02500zz-mz.dat","start":56443,"end":56502},{"filename":"/dsk/fi/estatico/t02500zz-mz.pid","start":56502,"end":56554},{"filename":"/dsk/fi/estatico/t02500zz-mz.vsc","start":56554,"end":80933},{"filename":"/dsk/fi/estatico/t02500zz-pu.dat","start":80933,"end":82354},{"filename":"/dsk/fi/estatico/t02500zz-pu.pid","start":82354,"end":82406},{"filename":"/dsk/fi/estatico/t02500zz-pu.vsc","start":82406,"end":97059},{"filename":"/dsk/fi/estatico/t02500zz000010001-el.pid","start":97059,"end":97126},{"filename":"/dsk/fi/estatico/t02500zz000010001-el.vsc","start":97126,"end":170332},{"filename":"/dsk/fi/estatico/t02500zz000010001-imp.pid","start":170332,"end":170400},{"filename":"/dsk/fi/estatico/t02500zz000010001-imp.vsc","start":170400,"end":243614},{"filename":"/dsk/fi/estatico/t02500zz000010001-se.dat","start":243614,"end":243764},{"filename":"/dsk/fi/estatico/t02500zz000010001-se.pid","start":243764,"end":243831},{"filename":"/dsk/fi/estatico/t02500zz000010001-se.vsc","start":243831,"end":243831},{"filename":"/dsk/fi/estatico/t02500zz000010001-tte.pid","start":243831,"end":243899},{"filename":"/dsk/fi/estatico/t02500zz000010001-tte.vsc","start":243899,"end":317107},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-el.dat","start":317107,"end":317244},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-el.vsc","start":317244,"end":317244},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-imp.dat","start":317244,"end":317310},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-imp.vsc","start":317310,"end":317310},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-tte.dat","start":317310,"end":317352},{"filename":"/dsk/fi/estatico/t02500zz0000100010001-tte.vsc","start":317352,"end":317352},{"filename":"/dsk/fi/estatico/t02510zz-cfm.dat","start":317352,"end":317606},{"filename":"/dsk/fi/estatico/t02510zz-cfm.vsc","start":317606,"end":317606},{"filename":"/dsk/fi/estatico/t02510zz-cm.dat","start":317606,"end":317680},{"filename":"/dsk/fi/estatico/t02510zz-cm.pid","start":317680,"end":317732},{"filename":"/dsk/fi/estatico/t02510zz-cm.vsc","start":317732,"end":337248},{"filename":"/dsk/fi/estatico/t02510zz-ste.dat","start":337248,"end":337293},{"filename":"/dsk/fi/estatico/t02510zz-ste.pid","start":337293,"end":337346},{"filename":"/dsk/fi/estatico/t02510zz-ste.vsc","start":337346,"end":361730},{"filename":"/dsk/fi/estatico/t02511br00000-ca.dat","start":361730,"end":362459},{"filename":"/dsk/fi/estatico/t02511br00000-ca.pid","start":362459,"end":362516},{"filename":"/dsk/fi/estatico/t02511br00000-ca.vsc","start":362516,"end":411260},{"filename":"/dsk/fi/estatico/t02511br00000-co.dat","start":411260,"end":411292},{"filename":"/dsk/fi/estatico/t02511br00000-co.vsc","start":411292,"end":411292},{"filename":"/dsk/fi/estatico/t02511br00000-fe.dat","start":411292,"end":411317},{"filename":"/dsk/fi/estatico/t02511br00000-fe.vsc","start":411317,"end":411317},{"filename":"/dsk/fi/estatico/t02511br00000-fo.dat","start":411317,"end":524940},{"filename":"/dsk/fi/estatico/t02511br00000-fo.pid","start":524940,"end":524997},{"filename":"/dsk/fi/estatico/t02511br00000-fo.vsc","start":524997,"end":544531},{"filename":"/dsk/fi/estatico/t02511br00000-le.dat","start":544531,"end":544563},{"filename":"/dsk/fi/estatico/t02511br00000-le.vsc","start":544563,"end":544563},{"filename":"/dsk/fi/estatico/t02511br00000-pa.dat","start":544563,"end":544781},{"filename":"/dsk/fi/estatico/t02511br00000-pa.vsc","start":544781,"end":544781},{"filename":"/dsk/fi/estatico/t02511br00000-pi.dat","start":544781,"end":544808},{"filename":"/dsk/fi/estatico/t02511br00000-pi.vsc","start":544808,"end":544808},{"filename":"/dsk/fi/estatico/t02511br00000-rdj.dat","start":544808,"end":544837},{"filename":"/dsk/fi/estatico/t02511br00000-rdj.vsc","start":544837,"end":544837},{"filename":"/dsk/fi/estatico/t02511zz-ce.dat","start":544837,"end":545073},{"filename":"/dsk/fi/estatico/t02511zz-ce.pid","start":545073,"end":545125},{"filename":"/dsk/fi/estatico/t02511zz-ce.vsc","start":545125,"end":564642},{"filename":"/dsk/fi/serialv.dat","start":564642,"end":564650}]});
})();
