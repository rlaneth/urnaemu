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

  carregarPacote({"data":"geral-t1.data","remote_package_size":1291231,"files":[{"filename":"/cenario.json","start":0,"end":513},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":513,"end":600},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":600,"end":600},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.dat","start":600,"end":772},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.vsc","start":772,"end":772},{"filename":"/dsk/fi/estatico/scueconf-t1.dat","start":772,"end":850},{"filename":"/dsk/fi/estatico/scueconf-t1.vsc","start":850,"end":850},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":850,"end":2271},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2271,"end":2323},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2323,"end":16976},{"filename":"/dsk/fi/estatico/t02500-cp.dat","start":16976,"end":17141},{"filename":"/dsk/fi/estatico/t02500-cp.pid","start":17141,"end":17187},{"filename":"/dsk/fi/estatico/t02500-cp.vsc","start":17187,"end":36698},{"filename":"/dsk/fi/estatico/t02500ac-mme.dat","start":36698,"end":36725},{"filename":"/dsk/fi/estatico/t02500ac-mme.pid","start":36725,"end":36778},{"filename":"/dsk/fi/estatico/t02500ac-mme.vsc","start":36778,"end":56297},{"filename":"/dsk/fi/estatico/t02500ac-mu.dat","start":56297,"end":56415},{"filename":"/dsk/fi/estatico/t02500ac-mu.vsc","start":56415,"end":56415},{"filename":"/dsk/fi/estatico/t02500ac-mz.dat","start":56415,"end":56474},{"filename":"/dsk/fi/estatico/t02500ac-mz.pid","start":56474,"end":56526},{"filename":"/dsk/fi/estatico/t02500ac-mz.vsc","start":56526,"end":80905},{"filename":"/dsk/fi/estatico/t02500ac-pu.dat","start":80905,"end":82326},{"filename":"/dsk/fi/estatico/t02500ac-pu.pid","start":82326,"end":82378},{"filename":"/dsk/fi/estatico/t02500ac-pu.vsc","start":82378,"end":97031},{"filename":"/dsk/fi/estatico/t02500ac000010001-el.pid","start":97031,"end":97098},{"filename":"/dsk/fi/estatico/t02500ac000010001-el.vsc","start":97098,"end":170304},{"filename":"/dsk/fi/estatico/t02500ac000010001-imp.pid","start":170304,"end":170372},{"filename":"/dsk/fi/estatico/t02500ac000010001-imp.vsc","start":170372,"end":243586},{"filename":"/dsk/fi/estatico/t02500ac000010001-se.dat","start":243586,"end":243736},{"filename":"/dsk/fi/estatico/t02500ac000010001-se.pid","start":243736,"end":243803},{"filename":"/dsk/fi/estatico/t02500ac000010001-se.vsc","start":243803,"end":243803},{"filename":"/dsk/fi/estatico/t02500ac000010001-tte.pid","start":243803,"end":243871},{"filename":"/dsk/fi/estatico/t02500ac000010001-tte.vsc","start":243871,"end":317079},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-el.dat","start":317079,"end":317216},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-el.vsc","start":317216,"end":317216},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-imp.dat","start":317216,"end":317282},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-imp.vsc","start":317282,"end":317282},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-tte.dat","start":317282,"end":317324},{"filename":"/dsk/fi/estatico/t02500ac0000100010001-tte.vsc","start":317324,"end":317324},{"filename":"/dsk/fi/estatico/t02510ac-cfm.dat","start":317324,"end":317578},{"filename":"/dsk/fi/estatico/t02510ac-cfm.vsc","start":317578,"end":317578},{"filename":"/dsk/fi/estatico/t02510ac-cm.dat","start":317578,"end":317652},{"filename":"/dsk/fi/estatico/t02510ac-cm.pid","start":317652,"end":317704},{"filename":"/dsk/fi/estatico/t02510ac-cm.vsc","start":317704,"end":337220},{"filename":"/dsk/fi/estatico/t02510ac-ste.dat","start":337220,"end":337283},{"filename":"/dsk/fi/estatico/t02510ac-ste.pid","start":337283,"end":337336},{"filename":"/dsk/fi/estatico/t02510ac-ste.vsc","start":337336,"end":361720},{"filename":"/dsk/fi/estatico/t02511ac-ce.dat","start":361720,"end":361956},{"filename":"/dsk/fi/estatico/t02511ac-ce.pid","start":361956,"end":362008},{"filename":"/dsk/fi/estatico/t02511ac-ce.vsc","start":362008,"end":381525},{"filename":"/dsk/fi/estatico/t02511br00000-ca.dat","start":381525,"end":382254},{"filename":"/dsk/fi/estatico/t02511br00000-ca.pid","start":382254,"end":382311},{"filename":"/dsk/fi/estatico/t02511br00000-ca.vsc","start":382311,"end":431055},{"filename":"/dsk/fi/estatico/t02511br00000-co.dat","start":431055,"end":431087},{"filename":"/dsk/fi/estatico/t02511br00000-co.vsc","start":431087,"end":431087},{"filename":"/dsk/fi/estatico/t02511br00000-fe.dat","start":431087,"end":431112},{"filename":"/dsk/fi/estatico/t02511br00000-fe.vsc","start":431112,"end":431112},{"filename":"/dsk/fi/estatico/t02511br00000-fo.dat","start":431112,"end":544735},{"filename":"/dsk/fi/estatico/t02511br00000-fo.pid","start":544735,"end":544792},{"filename":"/dsk/fi/estatico/t02511br00000-fo.vsc","start":544792,"end":564326},{"filename":"/dsk/fi/estatico/t02511br00000-le.dat","start":564326,"end":564358},{"filename":"/dsk/fi/estatico/t02511br00000-le.vsc","start":564358,"end":564358},{"filename":"/dsk/fi/estatico/t02511br00000-pa.dat","start":564358,"end":564576},{"filename":"/dsk/fi/estatico/t02511br00000-pa.vsc","start":564576,"end":564576},{"filename":"/dsk/fi/estatico/t02511br00000-pi.dat","start":564576,"end":564603},{"filename":"/dsk/fi/estatico/t02511br00000-pi.vsc","start":564603,"end":564603},{"filename":"/dsk/fi/estatico/t02511br00000-rdj.dat","start":564603,"end":564632},{"filename":"/dsk/fi/estatico/t02511br00000-rdj.vsc","start":564632,"end":564632},{"filename":"/dsk/fi/estatico/t02512ac-ce.dat","start":564632,"end":565291},{"filename":"/dsk/fi/estatico/t02512ac-ce.pid","start":565291,"end":565343},{"filename":"/dsk/fi/estatico/t02512ac-ce.vsc","start":565343,"end":584860},{"filename":"/dsk/fi/estatico/t02512ac00000-ca.dat","start":584860,"end":588072},{"filename":"/dsk/fi/estatico/t02512ac00000-ca.pid","start":588072,"end":588129},{"filename":"/dsk/fi/estatico/t02512ac00000-ca.vsc","start":588129,"end":636873},{"filename":"/dsk/fi/estatico/t02512ac00000-co.dat","start":636873,"end":636911},{"filename":"/dsk/fi/estatico/t02512ac00000-co.vsc","start":636911,"end":636911},{"filename":"/dsk/fi/estatico/t02512ac00000-fe.dat","start":636911,"end":636936},{"filename":"/dsk/fi/estatico/t02512ac00000-fe.vsc","start":636936,"end":636936},{"filename":"/dsk/fi/estatico/t02512ac00000-fo.dat","start":636936,"end":1271314},{"filename":"/dsk/fi/estatico/t02512ac00000-fo.pid","start":1271314,"end":1271371},{"filename":"/dsk/fi/estatico/t02512ac00000-fo.vsc","start":1271371,"end":1290905},{"filename":"/dsk/fi/estatico/t02512ac00000-le.dat","start":1290905,"end":1290943},{"filename":"/dsk/fi/estatico/t02512ac00000-le.vsc","start":1290943,"end":1290943},{"filename":"/dsk/fi/estatico/t02512ac00000-pa.dat","start":1290943,"end":1291167},{"filename":"/dsk/fi/estatico/t02512ac00000-pa.vsc","start":1291167,"end":1291167},{"filename":"/dsk/fi/estatico/t02512ac00000-pi.dat","start":1291167,"end":1291194},{"filename":"/dsk/fi/estatico/t02512ac00000-pi.vsc","start":1291194,"end":1291194},{"filename":"/dsk/fi/estatico/t02512ac00000-rdj.dat","start":1291194,"end":1291223},{"filename":"/dsk/fi/estatico/t02512ac00000-rdj.vsc","start":1291223,"end":1291223},{"filename":"/dsk/fi/serialv.dat","start":1291223,"end":1291231}]});
})();
