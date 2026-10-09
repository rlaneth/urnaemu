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

  carregarPacote({"data":"geral-t2.data","remote_package_size":627963,"files":[{"filename":"/cenario.json","start":0,"end":513},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":513,"end":600},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":600,"end":600},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.dat","start":600,"end":772},{"filename":"/dsk/fi/estatico/infomidia-fv-2-t.vsc","start":772,"end":772},{"filename":"/dsk/fi/estatico/scueconf-t2.dat","start":772,"end":850},{"filename":"/dsk/fi/estatico/scueconf-t2.vsc","start":850,"end":850},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":850,"end":2271},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2271,"end":2323},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2323,"end":16976},{"filename":"/dsk/fi/estatico/t02500-cp.dat","start":16976,"end":17141},{"filename":"/dsk/fi/estatico/t02500-cp.pid","start":17141,"end":17187},{"filename":"/dsk/fi/estatico/t02500-cp.vsc","start":17187,"end":36698},{"filename":"/dsk/fi/estatico/t02500ac-mme.dat","start":36698,"end":36725},{"filename":"/dsk/fi/estatico/t02500ac-mme.pid","start":36725,"end":36778},{"filename":"/dsk/fi/estatico/t02500ac-mme.vsc","start":36778,"end":56297},{"filename":"/dsk/fi/estatico/t02500ac-mu.dat","start":56297,"end":56415},{"filename":"/dsk/fi/estatico/t02500ac-mu.vsc","start":56415,"end":56415},{"filename":"/dsk/fi/estatico/t02500ac-mz.dat","start":56415,"end":56474},{"filename":"/dsk/fi/estatico/t02500ac-mz.pid","start":56474,"end":56526},{"filename":"/dsk/fi/estatico/t02500ac-mz.vsc","start":56526,"end":80905},{"filename":"/dsk/fi/estatico/t02500ac-pu.dat","start":80905,"end":82326},{"filename":"/dsk/fi/estatico/t02500ac-pu.pid","start":82326,"end":82378},{"filename":"/dsk/fi/estatico/t02500ac-pu.vsc","start":82378,"end":97031},{"filename":"/dsk/fi/estatico/t02500ac000010001-el.pid","start":97031,"end":97098},{"filename":"/dsk/fi/estatico/t02500ac000010001-el.vsc","start":97098,"end":170304},{"filename":"/dsk/fi/estatico/t02500ac000010001-imp.pid","start":170304,"end":170372},{"filename":"/dsk/fi/estatico/t02500ac000010001-imp.vsc","start":170372,"end":243586},{"filename":"/dsk/fi/estatico/t02500ac000010001-se.dat","start":243586,"end":243736},{"filename":"/dsk/fi/estatico/t02500ac000010001-se.pid","start":243736,"end":243803},{"filename":"/dsk/fi/estatico/t02500ac000010001-se.vsc","start":243803,"end":243803},{"filename":"/dsk/fi/estatico/t02500ac000010001-tte.pid","start":243803,"end":243871},{"filename":"/dsk/fi/estatico/t02500ac000010001-tte.vsc","start":243871,"end":317079},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-el.dat","start":317079,"end":317199},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-el.vsc","start":317199,"end":317199},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-imp.dat","start":317199,"end":317265},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-imp.vsc","start":317265,"end":317265},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-tte.dat","start":317265,"end":317307},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-tte.vsc","start":317307,"end":317307},{"filename":"/dsk/fi/estatico/t02520ac-cfm.dat","start":317307,"end":317561},{"filename":"/dsk/fi/estatico/t02520ac-cfm.vsc","start":317561,"end":317561},{"filename":"/dsk/fi/estatico/t02520ac-cm.dat","start":317561,"end":317635},{"filename":"/dsk/fi/estatico/t02520ac-cm.pid","start":317635,"end":317687},{"filename":"/dsk/fi/estatico/t02520ac-cm.vsc","start":317687,"end":337203},{"filename":"/dsk/fi/estatico/t02520ac-ste.dat","start":337203,"end":337266},{"filename":"/dsk/fi/estatico/t02520ac-ste.pid","start":337266,"end":337319},{"filename":"/dsk/fi/estatico/t02520ac-ste.vsc","start":337319,"end":361703},{"filename":"/dsk/fi/estatico/t02521ac-ce.dat","start":361703,"end":361939},{"filename":"/dsk/fi/estatico/t02521ac-ce.pid","start":361939,"end":361991},{"filename":"/dsk/fi/estatico/t02521ac-ce.vsc","start":361991,"end":381508},{"filename":"/dsk/fi/estatico/t02521br00000-ca.dat","start":381508,"end":381787},{"filename":"/dsk/fi/estatico/t02521br00000-ca.pid","start":381787,"end":381844},{"filename":"/dsk/fi/estatico/t02521br00000-ca.vsc","start":381844,"end":430587},{"filename":"/dsk/fi/estatico/t02521br00000-co.dat","start":430587,"end":430619},{"filename":"/dsk/fi/estatico/t02521br00000-co.vsc","start":430619,"end":430619},{"filename":"/dsk/fi/estatico/t02521br00000-fe.dat","start":430619,"end":430644},{"filename":"/dsk/fi/estatico/t02521br00000-fe.vsc","start":430644,"end":430644},{"filename":"/dsk/fi/estatico/t02521br00000-fo.dat","start":430644,"end":475735},{"filename":"/dsk/fi/estatico/t02521br00000-fo.pid","start":475735,"end":475792},{"filename":"/dsk/fi/estatico/t02521br00000-fo.vsc","start":475792,"end":495326},{"filename":"/dsk/fi/estatico/t02521br00000-le.dat","start":495326,"end":495358},{"filename":"/dsk/fi/estatico/t02521br00000-le.vsc","start":495358,"end":495358},{"filename":"/dsk/fi/estatico/t02521br00000-pa.dat","start":495358,"end":495463},{"filename":"/dsk/fi/estatico/t02521br00000-pa.vsc","start":495463,"end":495463},{"filename":"/dsk/fi/estatico/t02521br00000-pi.dat","start":495463,"end":495490},{"filename":"/dsk/fi/estatico/t02521br00000-pi.vsc","start":495490,"end":495490},{"filename":"/dsk/fi/estatico/t02521br00000-rdj.dat","start":495490,"end":495519},{"filename":"/dsk/fi/estatico/t02521br00000-rdj.vsc","start":495519,"end":495519},{"filename":"/dsk/fi/estatico/t02522ac-ce.dat","start":495519,"end":495756},{"filename":"/dsk/fi/estatico/t02522ac-ce.pid","start":495756,"end":495808},{"filename":"/dsk/fi/estatico/t02522ac-ce.vsc","start":495808,"end":515325},{"filename":"/dsk/fi/estatico/t02522ac00000-ca.dat","start":515325,"end":515609},{"filename":"/dsk/fi/estatico/t02522ac00000-ca.pid","start":515609,"end":515666},{"filename":"/dsk/fi/estatico/t02522ac00000-ca.vsc","start":515666,"end":564409},{"filename":"/dsk/fi/estatico/t02522ac00000-co.dat","start":564409,"end":564447},{"filename":"/dsk/fi/estatico/t02522ac00000-co.vsc","start":564447,"end":564447},{"filename":"/dsk/fi/estatico/t02522ac00000-fe.dat","start":564447,"end":564472},{"filename":"/dsk/fi/estatico/t02522ac00000-fe.vsc","start":564472,"end":564472},{"filename":"/dsk/fi/estatico/t02522ac00000-fo.dat","start":564472,"end":608159},{"filename":"/dsk/fi/estatico/t02522ac00000-fo.pid","start":608159,"end":608216},{"filename":"/dsk/fi/estatico/t02522ac00000-fo.vsc","start":608216,"end":627750},{"filename":"/dsk/fi/estatico/t02522ac00000-le.dat","start":627750,"end":627788},{"filename":"/dsk/fi/estatico/t02522ac00000-le.vsc","start":627788,"end":627788},{"filename":"/dsk/fi/estatico/t02522ac00000-pa.dat","start":627788,"end":627899},{"filename":"/dsk/fi/estatico/t02522ac00000-pa.vsc","start":627899,"end":627899},{"filename":"/dsk/fi/estatico/t02522ac00000-pi.dat","start":627899,"end":627926},{"filename":"/dsk/fi/estatico/t02522ac00000-pi.vsc","start":627926,"end":627926},{"filename":"/dsk/fi/estatico/t02522ac00000-rdj.dat","start":627926,"end":627955},{"filename":"/dsk/fi/estatico/t02522ac00000-rdj.vsc","start":627955,"end":627955},{"filename":"/dsk/fi/serialv.dat","start":627955,"end":627963}]});
})();
