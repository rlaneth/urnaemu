
  var Module = typeof Module != 'undefined' ? Module : {};

  if (!Module['expectedDataFileDownloads']) Module['expectedDataFileDownloads'] = 0;
  Module['expectedDataFileDownloads']++;
  (() => {
    // Do not attempt to redownload the virtual filesystem data when in a pthread or a Wasm Worker context.
    var isPthread = typeof ENVIRONMENT_IS_PTHREAD != 'undefined' && ENVIRONMENT_IS_PTHREAD;
    var isWasmWorker = typeof ENVIRONMENT_IS_WASM_WORKER != 'undefined' && ENVIRONMENT_IS_WASM_WORKER;
    if (isPthread || isWasmWorker) return;
    async function loadPackage(metadata) {

      var PACKAGE_PATH = '';
      if (typeof window === 'object') {
        PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/');
      } else if (typeof process === 'undefined' && typeof location !== 'undefined') {
        // web worker
        PACKAGE_PATH = encodeURIComponent(location.pathname.substring(0, location.pathname.lastIndexOf('/')) + '/');
      }
      var PACKAGE_NAME = '/home/rubio/tse/uenux2/build/wasm-conan/wasm/vota_web/rhvoice-leticia.data';
      var REMOTE_PACKAGE_BASE = 'rhvoice-leticia.data';
      var REMOTE_PACKAGE_NAME = Module['locateFile'] ? Module['locateFile'](REMOTE_PACKAGE_BASE, '') : REMOTE_PACKAGE_BASE;
      var REMOTE_PACKAGE_SIZE = metadata['remote_package_size'];

      async function fetchRemotePackage(packageName, packageSize) {
        
        if (!Module['dataFileDownloads']) Module['dataFileDownloads'] = {};
        try {
          var response = await fetch(packageName);
        } catch (e) {
          throw new Error(`Network Error: ${packageName}`, {e});
        }
        if (!response.ok) {
          throw new Error(`${response.status}: ${response.url}`);
        }

        const chunks = [];
        const headers = response.headers;
        const total = Number(headers.get('Content-Length') || packageSize);
        let loaded = 0;

        Module['setStatus'] && Module['setStatus']('Downloading data...');
        const reader = response.body.getReader();

        while (1) {
          var {done, value} = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;
          Module['dataFileDownloads'][packageName] = {loaded, total};

          let totalLoaded = 0;
          let totalSize = 0;

          for (const download of Object.values(Module['dataFileDownloads'])) {
            totalLoaded += download.loaded;
            totalSize += download.total;
          }

          Module['setStatus'] && Module['setStatus'](`Downloading data... (${totalLoaded}/${totalSize})`);
        }

        const packageData = new Uint8Array(chunks.map((c) => c.length).reduce((a, b) => a + b, 0));
        let offset = 0;
        for (const chunk of chunks) {
          packageData.set(chunk, offset);
          offset += chunk.length;
        }
        return packageData.buffer;
      }

      var fetchPromise;
      var fetched = Module['getPreloadedPackage'] && Module['getPreloadedPackage'](REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE);

      if (!fetched) {
        // Note that we don't use await here because we want to execute the
        // the rest of this function immediately.
        fetchPromise = fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE);
      }

    async function runWithFS(Module) {

      function assert(check, msg) {
        if (!check) throw new Error(msg);
      }
Module['FS_createPath']("/", "etc", true, true);
Module['FS_createPath']("/etc", "RHVoice", true, true);
Module['FS_createPath']("/", "share", true, true);
Module['FS_createPath']("/share", "RHVoice", true, true);
Module['FS_createPath']("/share/RHVoice", "languages", true, true);
Module['FS_createPath']("/share/RHVoice/languages", "Brazilian-Portuguese", true, true);
Module['FS_createPath']("/share/RHVoice/languages/Brazilian-Portuguese", "userdict", true, true);
Module['FS_createPath']("/share/RHVoice/languages/Brazilian-Portuguese/userdict", "src", true, true);
Module['FS_createPath']("/share/RHVoice", "voices", true, true);
Module['FS_createPath']("/share/RHVoice/voices", "Leticia-F123", true, true);
Module['FS_createPath']("/share/RHVoice/voices/Leticia-F123", "16000", true, true);

    for (var file of metadata['files']) {
      var name = file['filename']
      Module['addRunDependency'](`fp ${name}`);
    }

      async function processPackageData(arrayBuffer) {
        assert(arrayBuffer, 'Loading data file failed.');
        assert(arrayBuffer.constructor.name === ArrayBuffer.name, 'bad input to processPackageData ' + arrayBuffer.constructor.name);
        var byteArray = new Uint8Array(arrayBuffer);
        var curr;
        // Reuse the bytearray from the XHR as the source for file reads.
          for (var file of metadata['files']) {
            var name = file['filename'];
            var data = byteArray.subarray(file['start'], file['end']);
            // canOwn this data in the filesystem, it is a slice into the heap that will never change
        Module['FS_createDataFile'](name, null, data, true, true, true);
        Module['removeRunDependency'](`fp ${name}`);
          }
          Module['removeRunDependency']('datafile_/home/rubio/tse/uenux2/build/wasm-conan/wasm/vota_web/rhvoice-leticia.data');
      }
      Module['addRunDependency']('datafile_/home/rubio/tse/uenux2/build/wasm-conan/wasm/vota_web/rhvoice-leticia.data');

      if (!Module['preloadResults']) Module['preloadResults'] = {};

      Module['preloadResults'][PACKAGE_NAME] = {fromCache: false};
      if (!fetched) {
        fetched = await fetchPromise;
      }
      processPackageData(fetched);

    }
    if (Module['calledRun']) {
      runWithFS(Module);
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module['preRun'].push(runWithFS); // FS is not initialized yet, wait for it
    }

    }
    loadPackage({"files": [{"filename": "/etc/RHVoice/RHVoice.conf", "start": 0, "end": 840}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/accented.dt", "start": 840, "end": 843}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/downcase.fst", "start": 843, "end": 1734}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/dur-mod.dt", "start": 1734, "end": 1928}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/emoji.fst", "start": 1928, "end": 97165}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/english_phone_mapping.fst", "start": 97165, "end": 97184}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/enwords.fst", "start": 97184, "end": 97203}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/g2p.fst", "start": 97203, "end": 1299105}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/gpos.fst", "start": 1299105, "end": 1302604}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/homographs.fst", "start": 1302604, "end": 1312191}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/key.fst", "start": 1312191, "end": 1314815}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/labelling.xml", "start": 1314815, "end": 1317231}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/language.conf", "start": 1317231, "end": 1317231}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/language.info", "start": 1317231, "end": 1317388}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/lseq.fst", "start": 1317388, "end": 1319298}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/msg.fst", "start": 1319298, "end": 1319414}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/norm.fst", "start": 1319414, "end": 1319433}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/numbers.fst", "start": 1319433, "end": 1329177}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/pg2p.fst", "start": 1329177, "end": 1329196}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/phonemes.xml", "start": 1329196, "end": 1332814}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/phrasing.dt", "start": 1332814, "end": 1333017}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/pitch-mod.dt", "start": 1333017, "end": 1335008}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/qst.fst", "start": 1335008, "end": 1342302}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/sl_phone_mapping.fst", "start": 1342302, "end": 1342321}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/spell.fst", "start": 1342321, "end": 1344533}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/syl.fst", "start": 1344533, "end": 1349321}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/tok.fst", "start": 1349321, "end": 1376795}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/userdict/src/dict.txt", "start": 1376795, "end": 1379325}, {"filename": "/share/RHVoice/languages/Brazilian-Portuguese/vocab.fst", "start": 1379325, "end": 1379344}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/bap.pdf", "start": 1379344, "end": 3176256}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/bap.win1", "start": 3176256, "end": 3176262}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/bap.win2", "start": 3176262, "end": 3176277}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/bap.win3", "start": 3176277, "end": 3176292}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/bpf.txt", "start": 3176292, "end": 3182886}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/dur.pdf", "start": 3182886, "end": 3256062}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/lf0.pdf", "start": 3256062, "end": 3939998}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/lf0.win1", "start": 3939998, "end": 3940004}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/lf0.win2", "start": 3940004, "end": 3940019}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/lf0.win3", "start": 3940019, "end": 3940034}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/mgc.pdf", "start": 3940034, "end": 7195666}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/mgc.win1", "start": 7195666, "end": 7195672}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/mgc.win2", "start": 7195672, "end": 7195687}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/mgc.win3", "start": 7195687, "end": 7195702}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/tree-bap.inf", "start": 7195702, "end": 8584892}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/tree-dur.inf", "start": 8584892, "end": 8797477}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/tree-lf0.inf", "start": 8797477, "end": 10118916}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/tree-mgc.inf", "start": 10118916, "end": 10632138}, {"filename": "/share/RHVoice/voices/Leticia-F123/16000/voice.data", "start": 10632138, "end": 19594259}, {"filename": "/share/RHVoice/voices/Leticia-F123/voice.info", "start": 19594259, "end": 19594559}, {"filename": "/share/RHVoice/voices/Leticia-F123/voice.params", "start": 19594559, "end": 19594600}], "remote_package_size": 19594600});

  })();
