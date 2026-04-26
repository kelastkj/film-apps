/**
 * ==========================================
 * KONFIGURASI SISTEM
 * ==========================================
 */
const CONFIG = {
  TMDB_API_KEY: '##', // Dapatkan di themoviedb.org
  DRIVE_FOLDER_ID: '##', // ID folder tempat film disimpan
  ADMIN_PASSWORD_DEFAULT: 'admin123' 
};

/**
 * PETA GENRE TMDB → Bahasa Indonesia
 */
const GENRE_MAP = {
  28:'Aksi', 12:'Petualangan', 16:'Animasi', 35:'Komedi', 80:'Kriminal',
  99:'Dokumenter', 18:'Drama', 10751:'Keluarga', 14:'Fantasi', 36:'Sejarah',
  27:'Horor', 10402:'Musik', 9648:'Misteri', 10749:'Romansa', 878:'Fiksi Ilmiah',
  53:'Thriller', 10752:'Perang', 37:'Western'
};

/**
 * FUNGSI UTAMA SINKRONISASI
 * Memindai Drive dan mencocokkan dengan TMDB
 */
function runSync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setupDatabase(ss); 
  
  const librarySheet = ss.getSheetByName('Film_Library');
  const lastRow = librarySheet.getLastRow();
  const allData = lastRow > 1
    ? librarySheet.getRange(2, 1, lastRow - 1, 11).getValues()
    : [];
  const existingIds = allData.map(row => String(row[0]));
  
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const files = folder.getFiles();
  
  while (files.hasNext()) {
    const file = files.next();
    const fileId = file.getId();
    const fileName = file.getName();
    
    if (!isVideo(fileName)) continue;
    
    const existingIdx = existingIds.indexOf(fileId);
    
    if (existingIdx === -1) {
      // File baru — tambahkan
      const metadata = fetchTMDBMetadata(fileName);
      librarySheet.appendRow([
        fileId,
        fileName,
        metadata.title || fileName,
        metadata.poster ? `https://image.tmdb.org/t/p/w500${metadata.poster}` : '',
        metadata.rating || '0',
        metadata.overview || 'Sinopsis tidak tersedia.',
        metadata.year || '-',
        new Date(),
        metadata.genres || '',
        metadata.seriesTitle || '',
        metadata.episodeNum || ''
      ]);
    } else {
      // File sudah ada — retry jika metadata belum berhasil
      const existingTitle = String(allData[existingIdx][2]);
      const existingPoster = String(allData[existingIdx][3]);
      const baseNameNoExt = fileName.replace(/\.[^/.]+$/, '');
      const metadataMissing = !existingPoster ||
        existingTitle === fileName ||
        existingTitle === baseNameNoExt ||
        existingTitle.trim() === '';
      if (metadataMissing) {
        const metadata = fetchTMDBMetadata(fileName);
        if (metadata.title) {
          const rowNum = existingIdx + 2;
          librarySheet.getRange(rowNum, 3).setValue(metadata.title);
          if (metadata.poster) librarySheet.getRange(rowNum, 4).setValue(`https://image.tmdb.org/t/p/w500${metadata.poster}`);
          if (metadata.rating) librarySheet.getRange(rowNum, 5).setValue(metadata.rating);
          if (metadata.overview) librarySheet.getRange(rowNum, 6).setValue(metadata.overview);
          if (metadata.year) librarySheet.getRange(rowNum, 7).setValue(metadata.year);
          librarySheet.getRange(rowNum, 8).setValue(new Date());
          if (metadata.genres) librarySheet.getRange(rowNum, 9).setValue(metadata.genres);
          librarySheet.getRange(rowNum, 10).setValue(metadata.seriesTitle || '');
          if (metadata.episodeNum) librarySheet.getRange(rowNum, 11).setValue(metadata.episodeNum);
        }
      }
    }
  }
  return "Sinkronisasi Berhasil!";
}

/**
 * SETUP DATABASE OTOMATIS
 * Membuat sheet, kolom, dan akun admin jika belum ada
 */
function setupDatabase(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Sheet Film_Library
  let libSheet = ss.getSheetByName('Film_Library');
  if (!libSheet) {
    libSheet = ss.insertSheet('Film_Library');
    const headers = ['file_id', 'file_name', 'official_title', 'poster_url', 'rating', 'overview', 'release_date', 'sync_date', 'genres', 'series_title', 'episode_num'];
    libSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');
    libSheet.setFrozenRows(1);
  } else {
    // Migrasi: tambahkan kolom baru jika belum ada
    const existingHeaders = libSheet.getRange(1, 1, 1, libSheet.getLastColumn()).getValues()[0];
    const newCols = ['genres', 'series_title', 'episode_num'];
    newCols.forEach(col => {
      if (!existingHeaders.includes(col)) {
        libSheet.getRange(1, libSheet.getLastColumn() + 1).setValue(col).setFontWeight('bold').setBackground('#f3f3f3');
      }
    });
    // Migrasi nama kolom lama -> baru jika perlu
    const remap = { 'title':'official_title', 'poster':'poster_url', 'year':'release_date', 'updated':'sync_date' };
    existingHeaders.forEach((h, i) => {
      if (remap[h]) libSheet.getRange(1, i + 1).setValue(remap[h]);
    });
  }

  // 2. Setup Sheet User_Accounts (Password Hashed)
  let userSheet = ss.getSheetByName('User_Accounts');
  if (!userSheet) {
    userSheet = ss.insertSheet('User_Accounts');
    // Menambahkan kolom full_name
    const headers = ['username', 'password_hash', 'role', 'full_name'];
    userSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#f3f3f3');
    
    // Hash password default untuk admin dan user pertama
    const adminHash = hashPassword(CONFIG.ADMIN_PASSWORD_DEFAULT);
    const userHash = hashPassword('12345');
    
    // Menambahkan data awal dengan Nama Lengkap
    userSheet.appendRow(['admin', adminHash, 'admin', 'Wibowo Laksono']);
    userSheet.appendRow(['user', userHash, 'user', 'Tamu Terhormat']);
    userSheet.setFrozenRows(1);
  }
}

/**
 * FUNGSI HASH PASSWORD (SHA-256)
 */
function hashPassword(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  let txtHash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length == 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

/**
 * PENGAMBILAN METADATA TMDB
 * Mendukung film biasa dan serial TV (episode)
 */
function fetchTMDBMetadata(fileName) {
  try {
    let cleanName = fileName.replace(/\.[^/.]+$/, '');

    // Ekstrak nomor episode dari nama file asli
    const epNumMatch = cleanName.match(/(?:episode\s*|ep\.?\s*)(\d+)\b/i)
      || cleanName.match(/\bs\d{1,2}\s*e(\d{1,2})\b/i)
      || cleanName.match(/\be(\d{1,2})\b/i);
    const episodeNum = epNumMatch ? parseInt(epNumMatch[1]) : '';

    // Deteksi pola episode/season
    const episodePattern = /\b(s\d{1,2}\s*e\d{1,2}|season\s*\d+|episode\s*\d+|ep\.?\s*\d+|\be\d{1,2}\b)/i;
    const isSeries = episodePattern.test(cleanName);

    // Bersihkan pola episode agar query TMDB lebih akurat
    cleanName = cleanName
      .replace(/\bs\d{1,2}\s*e\d{1,2}\b/gi, '')
      .replace(/\bseason\s*\d+\b/gi, '')
      .replace(/\bepisode\s*\d+\b/gi, '')
      .replace(/\bep\.?\s*\d+\b/gi, '')
      .replace(/\be\d{1,2}\b/gi, '')
      .replace(/[._-]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const apiKey = CONFIG.TMDB_API_KEY;
    const base   = 'https://api.themoviedb.org/3';

    const endpoints = isSeries
      ? [`${base}/search/tv`, `${base}/search/movie`]
      : [`${base}/search/movie`, `${base}/search/tv`];

    for (const endpoint of endpoints) {
      const url = `${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(cleanName)}&language=id-ID`;
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const results  = JSON.parse(response.getContentText()).results;

      if (results && results.length > 0) {
        const item        = results[0];
        const genres      = (item.genre_ids || [])
          .slice(0, 3)
          .map(id => GENRE_MAP[id] || '')
          .filter(Boolean)
          .join(',');
        const title       = item.title || item.name || '';
        const releaseDate = item.release_date || item.first_air_date || '';
        const isTV        = !item.title && !!item.name;

        return {
          title:       title,
          poster:      item.poster_path,
          rating:      item.vote_average,
          overview:    item.overview,
          year:        releaseDate ? releaseDate.split('-')[0] : '',
          genres:      genres,
          episodeNum:  episodeNum,
          seriesTitle: (isTV || isSeries) ? title : ''
        };
      }
    }
  } catch (e) {
    console.error('TMDB Error: ' + e.message);
  }
  return {};
}

/**
 * VALIDASI FORMAT VIDEO
 */
function isVideo(fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  return ['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext);
}

/**
 * ENDPOINT API (doGet)
 * Melayani request dari GitHub (Frontend)
 */
function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const output = (content) => {
    return ContentService.createTextOutput(JSON.stringify(content))
                         .setMimeType(ContentService.MimeType.JSON);
  };

  try {
    // API: Ambil Daftar Film
    if (action === 'getMovies') {
      const sheet = ss.getSheetByName('Film_Library');
      const data = sheet.getDataRange().getValues();
      const headers = data.shift();
      const json = data.map(row => {
        let obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      });
      return output(json);
    }

    // API: Validasi Login Aman (Hashing + Nama Lengkap)
    if (action === 'login') {
      const user = e.parameter.u;
      const pass = e.parameter.p;
      const userSheet = ss.getSheetByName('User_Accounts');
      const userData = userSheet.getDataRange().getValues();
      userData.shift(); // Hapus header

      const hashedInput = hashPassword(pass);
      // Mencari kecocokan username dan hash password
      const foundUser = userData.find(row => row[0] === user && row[1] === hashedInput);

      if (foundUser) {
        return output({ 
          status: "success", 
          role: foundUser[2], 
          username: foundUser[0],
          full_name: foundUser[3] // Mengirim nama lengkap ke frontend
        });
      } else {
        return output({ status: "error", message: "Username atau password salah" });
      }
    }

    // API: Trigger Sinkronisasi Manual
    if (action === 'sync') {
      return output({ status: "success", message: runSync() });
    }

  } catch (err) {
    return output({ status: "error", message: err.message });
  }
}