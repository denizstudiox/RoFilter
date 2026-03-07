let currentThreshold = 0;
let currentRemoveSponsored = false;

// Metin içerisinden yüzdelik sayıyı çeker
function getPercentage(text) {
    const match = text.match(/(\d+)%/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

// Oyunu sayfa içerisinden gizler/gösterir
function filterGames() {
    // Tüm oyun kartlarını seç
    const gameTiles = document.querySelectorAll('li.list-item, .grid-tile, .game-card-container');

    gameTiles.forEach(tile => {
        let shouldHide = false;

        // Sponsorlu oyun kontrolü - Sadece "Sponsored" kelimesi değil sınıfın kendisini veya içeriğini kontrol et
        if (currentRemoveSponsored) {
            // "Sponsored" etiketine sahip olan geniş kartları veya direkt etiketin kendisini arayalım
            const sponsoredLabel = tile.querySelector('.sponsored-ad-label, [title="Sponsored"], [aria-label="Sponsored"]');
            if (sponsoredLabel && (sponsoredLabel.textContent.includes('Sponsored') || sponsoredLabel.textContent.includes('Sponsorlu') || true)) {
                // Eğer etiket bulunduysa içeriğine bakmaksızın gizle (garanti)
                shouldHide = true;
            }
        }

        if (!shouldHide) {
            // Kartın içinde "vote-percentage-label" sınıfını bul
            const ratingElement = tile.querySelector('.vote-percentage-label');
            if (ratingElement) {
                const ratingText = ratingElement.getContext || ratingElement.textContent;
                const ratingValue = getPercentage(ratingText);

                if (ratingValue !== null) {
                    // Eğer oyunun yüzdesi filtrenin altındaysa widget'ı gizle
                    if (currentThreshold > 0 && ratingValue < currentThreshold) {
                        shouldHide = true;
                    }
                }
            }
        }

        if (shouldHide) {
            tile.style.display = 'none';
            tile.classList.add('roblox-filter-hidden');
        } else {
            tile.style.display = ''; // Eşit veya büyükse göster
            tile.classList.remove('roblox-filter-hidden');
        }
    });

    // Filtreleme sonrasında ekranda çok az oyun kalırsa takılmayı önlemek için sayfanın altına doğru kaydırma veya yükleme tetikle
    forceLoadMoreGames();
}

// Bazen çok fazla oyun silindiği için sayfa kaydırılamaz hale geliyor ve Roblox yeni oyun yüklemiyor.
// Bunu çözmek için kaydırma çubuğu kaybolduysa veya çok az oyun kaldıysa aşağı kaydırma tetikliyoruz.
function forceLoadMoreGames() {
    // Görünür olan oyun kutularını bul
    const visibleTiles = document.querySelectorAll('li.list-item:not(.roblox-filter-hidden)');

    // Eğer sayfadaki toplam görünür oyun sayısı azsa veya sayfa kaydırma gerektirmeyecek kadar kısaysa
    if (visibleTiles.length > 0 && visibleTiles.length < 12) {
        // Roblox'un yeni oyunları yüklemesi için sayfanın altına kaydırma simülasyonu yapıyoruz
        window.scrollBy(0, 10);
        setTimeout(() => window.scrollBy(0, -10), 50);

        // Veya scroll eventini manuel olarak ateşleyelim
        window.dispatchEvent(new Event('scroll'));
    }
}

// Başlangıçta kaydedilmiş veriyi al ve sayfayı filtrele
chrome.storage.sync.get(['minRatingThreshold', 'removeSponsored'], (data) => {
    if (data.minRatingThreshold !== undefined) {
        currentThreshold = parseInt(data.minRatingThreshold, 10);
    }
    if (data.removeSponsored !== undefined) {
        currentRemoveSponsored = data.removeSponsored;
    }
    filterGames();
});

// Eklenti ikonundan (popup) yeni bir değer girildiğinde anında çalıştırır
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "updateSettings" || request.action === "updateThreshold") {
        if (request.threshold !== undefined) currentThreshold = request.threshold;
        else if (request.value !== undefined) currentThreshold = request.value; // Geriye dönük uyumluluk

        if (request.removeSponsored !== undefined) currentRemoveSponsored = request.removeSponsored;

        filterGames();
        sendResponse({ status: "success" });

        // Eğer reload istenmişse sayfayı yenile
        if (request.reloadPage) {
            window.location.reload();
        }
    }
});

// Roblox sayfalarında kaydırma yapıldığında yeni oyunlar yüklenir. 
// Yeni oyunlar yüklendiğinde otomatik olarak tekrar filtrelemesi için MutationObserver kullanıyoruz
let filterTimeout = null;
const observer = new MutationObserver((mutations) => {
    let shouldFilter = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldFilter = true;
            break;
        }
    }

    if (shouldFilter) {
        if (filterTimeout) clearTimeout(filterTimeout);
        // Aşırı işlem yükünden kaçınmak için debouncing (500 ms)
        filterTimeout = setTimeout(() => {
            filterGames();
        }, 500);
    }
});

// Tüm sayfadaki değişimleri izlemeye başla
observer.observe(document.body, { childList: true, subtree: true });
