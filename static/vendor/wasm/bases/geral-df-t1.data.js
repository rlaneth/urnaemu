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

  carregarPacote({"data":"geral-df-t1.data","remote_package_size":1291300,"files":[{"filename":"/cenario.json","start":0,"end":551},{"filename":"/dsk/fi/estatico/0000100010001-lo.dat","start":551,"end":650},{"filename":"/dsk/fi/estatico/0000100010001-lo.vsc","start":650,"end":650},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.dat","start":650,"end":822},{"filename":"/dsk/fi/estatico/infomidia-fv-1-t.vsc","start":822,"end":822},{"filename":"/dsk/fi/estatico/scueconf-t1.dat","start":822,"end":900},{"filename":"/dsk/fi/estatico/scueconf-t1.vsc","start":900,"end":900},{"filename":"/dsk/fi/estatico/t00000br-pu.dat","start":900,"end":2321},{"filename":"/dsk/fi/estatico/t00000br-pu.pid","start":2321,"end":2373},{"filename":"/dsk/fi/estatico/t00000br-pu.vsc","start":2373,"end":17026},{"filename":"/dsk/fi/estatico/t02500-cp.dat","start":17026,"end":17191},{"filename":"/dsk/fi/estatico/t02500-cp.pid","start":17191,"end":17237},{"filename":"/dsk/fi/estatico/t02500-cp.vsc","start":17237,"end":36748},{"filename":"/dsk/fi/estatico/t02500df-mme.dat","start":36748,"end":36775},{"filename":"/dsk/fi/estatico/t02500df-mme.pid","start":36775,"end":36828},{"filename":"/dsk/fi/estatico/t02500df-mme.vsc","start":36828,"end":56347},{"filename":"/dsk/fi/estatico/t02500df-mu.dat","start":56347,"end":56478},{"filename":"/dsk/fi/estatico/t02500df-mu.vsc","start":56478,"end":56478},{"filename":"/dsk/fi/estatico/t02500df-mz.dat","start":56478,"end":56537},{"filename":"/dsk/fi/estatico/t02500df-mz.pid","start":56537,"end":56589},{"filename":"/dsk/fi/estatico/t02500df-mz.vsc","start":56589,"end":80969},{"filename":"/dsk/fi/estatico/t02500df-pu.dat","start":80969,"end":82390},{"filename":"/dsk/fi/estatico/t02500df-pu.pid","start":82390,"end":82442},{"filename":"/dsk/fi/estatico/t02500df-pu.vsc","start":82442,"end":97095},{"filename":"/dsk/fi/estatico/t02500df000010001-el.pid","start":97095,"end":97162},{"filename":"/dsk/fi/estatico/t02500df000010001-el.vsc","start":97162,"end":170368},{"filename":"/dsk/fi/estatico/t02500df000010001-imp.pid","start":170368,"end":170436},{"filename":"/dsk/fi/estatico/t02500df000010001-imp.vsc","start":170436,"end":243650},{"filename":"/dsk/fi/estatico/t02500df000010001-se.dat","start":243650,"end":243800},{"filename":"/dsk/fi/estatico/t02500df000010001-se.pid","start":243800,"end":243867},{"filename":"/dsk/fi/estatico/t02500df000010001-se.vsc","start":243867,"end":243867},{"filename":"/dsk/fi/estatico/t02500df000010001-tte.pid","start":243867,"end":243935},{"filename":"/dsk/fi/estatico/t02500df000010001-tte.vsc","start":243935,"end":317143},{"filename":"/dsk/fi/estatico/t02500df0000100010001-el.dat","start":317143,"end":317280},{"filename":"/dsk/fi/estatico/t02500df0000100010001-el.vsc","start":317280,"end":317280},{"filename":"/dsk/fi/estatico/t02500df0000100010001-imp.dat","start":317280,"end":317346},{"filename":"/dsk/fi/estatico/t02500df0000100010001-imp.vsc","start":317346,"end":317346},{"filename":"/dsk/fi/estatico/t02500df0000100010001-tte.dat","start":317346,"end":317388},{"filename":"/dsk/fi/estatico/t02500df0000100010001-tte.vsc","start":317388,"end":317388},{"filename":"/dsk/fi/estatico/t02510df-cfm.dat","start":317388,"end":317642},{"filename":"/dsk/fi/estatico/t02510df-cfm.vsc","start":317642,"end":317642},{"filename":"/dsk/fi/estatico/t02510df-cm.dat","start":317642,"end":317716},{"filename":"/dsk/fi/estatico/t02510df-cm.pid","start":317716,"end":317768},{"filename":"/dsk/fi/estatico/t02510df-cm.vsc","start":317768,"end":337284},{"filename":"/dsk/fi/estatico/t02510df-ste.dat","start":337284,"end":337347},{"filename":"/dsk/fi/estatico/t02510df-ste.pid","start":337347,"end":337400},{"filename":"/dsk/fi/estatico/t02510df-ste.vsc","start":337400,"end":361784},{"filename":"/dsk/fi/estatico/t02511br00000-ca.dat","start":361784,"end":362513},{"filename":"/dsk/fi/estatico/t02511br00000-ca.pid","start":362513,"end":362570},{"filename":"/dsk/fi/estatico/t02511br00000-ca.vsc","start":362570,"end":411314},{"filename":"/dsk/fi/estatico/t02511br00000-co.dat","start":411314,"end":411346},{"filename":"/dsk/fi/estatico/t02511br00000-co.vsc","start":411346,"end":411346},{"filename":"/dsk/fi/estatico/t02511br00000-fe.dat","start":411346,"end":411371},{"filename":"/dsk/fi/estatico/t02511br00000-fe.vsc","start":411371,"end":411371},{"filename":"/dsk/fi/estatico/t02511br00000-fo.dat","start":411371,"end":524994},{"filename":"/dsk/fi/estatico/t02511br00000-fo.pid","start":524994,"end":525051},{"filename":"/dsk/fi/estatico/t02511br00000-fo.vsc","start":525051,"end":544585},{"filename":"/dsk/fi/estatico/t02511br00000-le.dat","start":544585,"end":544617},{"filename":"/dsk/fi/estatico/t02511br00000-le.vsc","start":544617,"end":544617},{"filename":"/dsk/fi/estatico/t02511br00000-pa.dat","start":544617,"end":544835},{"filename":"/dsk/fi/estatico/t02511br00000-pa.vsc","start":544835,"end":544835},{"filename":"/dsk/fi/estatico/t02511br00000-pi.dat","start":544835,"end":544862},{"filename":"/dsk/fi/estatico/t02511br00000-pi.vsc","start":544862,"end":544862},{"filename":"/dsk/fi/estatico/t02511br00000-rdj.dat","start":544862,"end":544891},{"filename":"/dsk/fi/estatico/t02511br00000-rdj.vsc","start":544891,"end":544891},{"filename":"/dsk/fi/estatico/t02511df-ce.dat","start":544891,"end":545127},{"filename":"/dsk/fi/estatico/t02511df-ce.pid","start":545127,"end":545179},{"filename":"/dsk/fi/estatico/t02511df-ce.vsc","start":545179,"end":564696},{"filename":"/dsk/fi/estatico/t02512df-ce.dat","start":564696,"end":565358},{"filename":"/dsk/fi/estatico/t02512df-ce.pid","start":565358,"end":565410},{"filename":"/dsk/fi/estatico/t02512df-ce.vsc","start":565410,"end":584927},{"filename":"/dsk/fi/estatico/t02512df00000-ca.dat","start":584927,"end":588140},{"filename":"/dsk/fi/estatico/t02512df00000-ca.pid","start":588140,"end":588197},{"filename":"/dsk/fi/estatico/t02512df00000-ca.vsc","start":588197,"end":636941},{"filename":"/dsk/fi/estatico/t02512df00000-co.dat","start":636941,"end":636979},{"filename":"/dsk/fi/estatico/t02512df00000-co.vsc","start":636979,"end":636979},{"filename":"/dsk/fi/estatico/t02512df00000-fe.dat","start":636979,"end":637004},{"filename":"/dsk/fi/estatico/t02512df00000-fe.vsc","start":637004,"end":637004},{"filename":"/dsk/fi/estatico/t02512df00000-fo.dat","start":637004,"end":1271383},{"filename":"/dsk/fi/estatico/t02512df00000-fo.pid","start":1271383,"end":1271440},{"filename":"/dsk/fi/estatico/t02512df00000-fo.vsc","start":1271440,"end":1290974},{"filename":"/dsk/fi/estatico/t02512df00000-le.dat","start":1290974,"end":1291012},{"filename":"/dsk/fi/estatico/t02512df00000-le.vsc","start":1291012,"end":1291012},{"filename":"/dsk/fi/estatico/t02512df00000-pa.dat","start":1291012,"end":1291236},{"filename":"/dsk/fi/estatico/t02512df00000-pa.vsc","start":1291236,"end":1291236},{"filename":"/dsk/fi/estatico/t02512df00000-pi.dat","start":1291236,"end":1291263},{"filename":"/dsk/fi/estatico/t02512df00000-pi.vsc","start":1291263,"end":1291263},{"filename":"/dsk/fi/estatico/t02512df00000-rdj.dat","start":1291263,"end":1291292},{"filename":"/dsk/fi/estatico/t02512df00000-rdj.vsc","start":1291292,"end":1291292},{"filename":"/dsk/fi/serialv.dat","start":1291292,"end":1291300}]});
})();
