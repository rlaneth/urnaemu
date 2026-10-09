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

  carregarPacote({"data":"geral-df-t2.data","remote_package_size":628027,"files":[{"filename":"/cenario.json","start":0,"end":551},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":551,"end":650},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":650,"end":650},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.dat","start":650,"end":822},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.vsc","start":822,"end":822},{"filename":"/dsk/fi/estatico/scueconf-t2.dat","start":822,"end":900},{"filename":"/dsk/fi/estatico/scueconf-t2.vsc","start":900,"end":900},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":900,"end":2321},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2321,"end":2373},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2373,"end":17026},{"filename":"/dsk/fi/estatico/t02500-cp.dat","start":17026,"end":17191},{"filename":"/dsk/fi/estatico/t02500-cp.pid","start":17191,"end":17237},{"filename":"/dsk/fi/estatico/t02500-cp.vsc","start":17237,"end":36748},{"filename":"/dsk/fi/estatico/t02500df-mme.dat","start":36748,"end":36775},{"filename":"/dsk/fi/estatico/t02500df-mme.pid","start":36775,"end":36828},{"filename":"/dsk/fi/estatico/t02500df-mme.vsc","start":36828,"end":56347},{"filename":"/dsk/fi/estatico/t02500df-mu.dat","start":56347,"end":56478},{"filename":"/dsk/fi/estatico/t02500df-mu.vsc","start":56478,"end":56478},{"filename":"/dsk/fi/estatico/t02500df-mz.dat","start":56478,"end":56537},{"filename":"/dsk/fi/estatico/t02500df-mz.pid","start":56537,"end":56589},{"filename":"/dsk/fi/estatico/t02500df-mz.vsc","start":56589,"end":80969},{"filename":"/dsk/fi/estatico/t02500df-pu.dat","start":80969,"end":82390},{"filename":"/dsk/fi/estatico/t02500df-pu.pid","start":82390,"end":82442},{"filename":"/dsk/fi/estatico/t02500df-pu.vsc","start":82442,"end":97095},{"filename":"/dsk/fi/estatico/t02500df000010001-el.pid","start":97095,"end":97162},{"filename":"/dsk/fi/estatico/t02500df000010001-el.vsc","start":97162,"end":170368},{"filename":"/dsk/fi/estatico/t02500df000010001-imp.pid","start":170368,"end":170436},{"filename":"/dsk/fi/estatico/t02500df000010001-imp.vsc","start":170436,"end":243650},{"filename":"/dsk/fi/estatico/t02500df000010001-se.dat","start":243650,"end":243800},{"filename":"/dsk/fi/estatico/t02500df000010001-se.pid","start":243800,"end":243867},{"filename":"/dsk/fi/estatico/t02500df000010001-se.vsc","start":243867,"end":243867},{"filename":"/dsk/fi/estatico/t02500df000010001-tte.pid","start":243867,"end":243935},{"filename":"/dsk/fi/estatico/t02500df000010001-tte.vsc","start":243935,"end":317143},{"filename":"/dsk/fi/estatico/t02500df0000100010001-el.dat","start":317143,"end":317263},{"filename":"/dsk/fi/estatico/t02500df0000100010001-el.vsc","start":317263,"end":317263},{"filename":"/dsk/fi/estatico/t02500df0000100010001-imp.dat","start":317263,"end":317329},{"filename":"/dsk/fi/estatico/t02500df0000100010001-imp.vsc","start":317329,"end":317329},{"filename":"/dsk/fi/estatico/t02500df0000100010001-tte.dat","start":317329,"end":317371},{"filename":"/dsk/fi/estatico/t02500df0000100010001-tte.vsc","start":317371,"end":317371},{"filename":"/dsk/fi/estatico/t02520df-cfm.dat","start":317371,"end":317625},{"filename":"/dsk/fi/estatico/t02520df-cfm.vsc","start":317625,"end":317625},{"filename":"/dsk/fi/estatico/t02520df-cm.dat","start":317625,"end":317699},{"filename":"/dsk/fi/estatico/t02520df-cm.pid","start":317699,"end":317751},{"filename":"/dsk/fi/estatico/t02520df-cm.vsc","start":317751,"end":337267},{"filename":"/dsk/fi/estatico/t02520df-ste.dat","start":337267,"end":337330},{"filename":"/dsk/fi/estatico/t02520df-ste.pid","start":337330,"end":337383},{"filename":"/dsk/fi/estatico/t02520df-ste.vsc","start":337383,"end":361767},{"filename":"/dsk/fi/estatico/t02521br00000-ca.dat","start":361767,"end":362046},{"filename":"/dsk/fi/estatico/t02521br00000-ca.pid","start":362046,"end":362103},{"filename":"/dsk/fi/estatico/t02521br00000-ca.vsc","start":362103,"end":410846},{"filename":"/dsk/fi/estatico/t02521br00000-co.dat","start":410846,"end":410878},{"filename":"/dsk/fi/estatico/t02521br00000-co.vsc","start":410878,"end":410878},{"filename":"/dsk/fi/estatico/t02521br00000-fe.dat","start":410878,"end":410903},{"filename":"/dsk/fi/estatico/t02521br00000-fe.vsc","start":410903,"end":410903},{"filename":"/dsk/fi/estatico/t02521br00000-fo.dat","start":410903,"end":455994},{"filename":"/dsk/fi/estatico/t02521br00000-fo.pid","start":455994,"end":456051},{"filename":"/dsk/fi/estatico/t02521br00000-fo.vsc","start":456051,"end":475585},{"filename":"/dsk/fi/estatico/t02521br00000-le.dat","start":475585,"end":475617},{"filename":"/dsk/fi/estatico/t02521br00000-le.vsc","start":475617,"end":475617},{"filename":"/dsk/fi/estatico/t02521br00000-pa.dat","start":475617,"end":475722},{"filename":"/dsk/fi/estatico/t02521br00000-pa.vsc","start":475722,"end":475722},{"filename":"/dsk/fi/estatico/t02521br00000-pi.dat","start":475722,"end":475749},{"filename":"/dsk/fi/estatico/t02521br00000-pi.vsc","start":475749,"end":475749},{"filename":"/dsk/fi/estatico/t02521br00000-rdj.dat","start":475749,"end":475778},{"filename":"/dsk/fi/estatico/t02521br00000-rdj.vsc","start":475778,"end":475778},{"filename":"/dsk/fi/estatico/t02521df-ce.dat","start":475778,"end":476014},{"filename":"/dsk/fi/estatico/t02521df-ce.pid","start":476014,"end":476066},{"filename":"/dsk/fi/estatico/t02521df-ce.vsc","start":476066,"end":495583},{"filename":"/dsk/fi/estatico/t02522df-ce.dat","start":495583,"end":495820},{"filename":"/dsk/fi/estatico/t02522df-ce.pid","start":495820,"end":495872},{"filename":"/dsk/fi/estatico/t02522df-ce.vsc","start":495872,"end":515389},{"filename":"/dsk/fi/estatico/t02522df00000-ca.dat","start":515389,"end":515673},{"filename":"/dsk/fi/estatico/t02522df00000-ca.pid","start":515673,"end":515730},{"filename":"/dsk/fi/estatico/t02522df00000-ca.vsc","start":515730,"end":564473},{"filename":"/dsk/fi/estatico/t02522df00000-co.dat","start":564473,"end":564511},{"filename":"/dsk/fi/estatico/t02522df00000-co.vsc","start":564511,"end":564511},{"filename":"/dsk/fi/estatico/t02522df00000-fe.dat","start":564511,"end":564536},{"filename":"/dsk/fi/estatico/t02522df00000-fe.vsc","start":564536,"end":564536},{"filename":"/dsk/fi/estatico/t02522df00000-fo.dat","start":564536,"end":608223},{"filename":"/dsk/fi/estatico/t02522df00000-fo.pid","start":608223,"end":608280},{"filename":"/dsk/fi/estatico/t02522df00000-fo.vsc","start":608280,"end":627814},{"filename":"/dsk/fi/estatico/t02522df00000-le.dat","start":627814,"end":627852},{"filename":"/dsk/fi/estatico/t02522df00000-le.vsc","start":627852,"end":627852},{"filename":"/dsk/fi/estatico/t02522df00000-pa.dat","start":627852,"end":627963},{"filename":"/dsk/fi/estatico/t02522df00000-pa.vsc","start":627963,"end":627963},{"filename":"/dsk/fi/estatico/t02522df00000-pi.dat","start":627963,"end":627990},{"filename":"/dsk/fi/estatico/t02522df00000-pi.vsc","start":627990,"end":627990},{"filename":"/dsk/fi/estatico/t02522df00000-rdj.dat","start":627990,"end":628019},{"filename":"/dsk/fi/estatico/t02522df00000-rdj.vsc","start":628019,"end":628019},{"filename":"/dsk/fi/serialv.dat","start":628019,"end":628027}]});
})();
