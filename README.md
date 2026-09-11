# Steam USD -> TRY Fiyat Cevirici

Steam Store sayfalarindaki ABD dolari fiyatlarini guncel USD/TRY kuru ile Turk lirasina ceviren hafif bir Chrome/Chromium eklentisi.

## Ozellikler

- Steam Store'daki `$` fiyatlarini otomatik olarak `₺` cinsinden gosterir.
- Orijinal USD fiyatini koruyarak cevrilmis fiyati yaninda gosterir.
- USD/TRY kurunu otomatik olarak alir ve yerel cache'de saklar.
- Kur guncelleme islemini eklenti popup'undan veya sayfa uzerindeki panelden baslatir.
- Ceviri ozelligi acilip kapatilabilir.
- Steam Store disindaki sayfalarda calismaz.
- Chrome Manifest V3 altyapisini kullanir.

## Kurulum

1. Bu projeyi bilgisayariniza indirin veya klonlayin.
2. Chrome'da `chrome://extensions` adresini acin.
3. Sag ustten **Gelistiirici modu** secenegini etkinlestirin.
4. **Paketlenmemis oge yukle** butonuna tiklayin.
5. Bu klasoru secin:

   `steam-try-extension`

6. Steam Store sayfasini acin veya yenileyin.

## Kullanim

1. [Steam Store](https://store.steampowered.com/) sayfasini acin.
2. Eklenti ikonuna tiklayin.
3. Switch ile fiyat cevirisini etkinlestirin veya devre disi birakin.
4. Gerekirse **Kuru yenile** butonuyla kuru manuel olarak guncelleyin.

Etkinlestirildiginde Steam sayfasindaki uygun USD fiyatlari otomatik olarak TRY karsiliklariyla birlikte gosterilir.

## Ekran Goruntuleri

### Steam Store

![Steam Store uzerinde USD TRY fiyat cevirici]([screenshots/steam-store.png](https://github.com/ygtdmrlp/Steam-Kur-eviri/blob/main/screenshots/preview.png))

### Eklenti Popup'i

![Steam TRY eklenti popup arayuzu]([screenshots/popup.png](https://github.com/ygtdmrlp/Steam-Kur-eviri/blob/main/screenshots/preview.png))

> Gorselleri GitHub'da gostermek icin dosyalari `screenshots/steam-store.png` ve `screenshots/popup.png` konumlarina kaydedin.

## Kur Kaynaklari

Eklenti su servisleri sirayla kullanir:

1. `open.er-api.com`
2. `api.exchangerate-api.com`

Gecici ag hatalarinda son basarili kur cache'den kullanilir.

## Proje Yapisi

```text
steam-try-extension/
├── content.js       # Steam sayfasinda fiyat cevirme mantigi
├── manifest.json    # Chrome eklenti ayarlari
├── popup.html       # Eklenti popup arayuzu
├── popup.js         # Popup davranislari ve kur kontrolu
├── styles.css       # Popup ve sayfa ici panel stilleri
└── icons/           # Eklenti ikonlari
```

## Gelistirme

Dosyalarda degisiklik yaptiktan sonra:

1. `chrome://extensions` sayfasini acin.
2. Eklentinin yanindaki yenileme ikonuna tiklayin.
3. Steam Store sayfasini yenileyin.

## Izinler

Eklenti su izinleri kullanir:

- `storage`: Kur ve tercihleri yerel olarak saklamak icin.
- Steam Store host izni: Fiyatlari sayfa uzerinde donusturmek icin.
- Kur API host izinleri: Guncel USD/TRY kurunu almak icin.

## Gelistirici

[ygtdmrlp](https://github.com/ygtdmrlp)

## Lisans

Bu proje kisisel ve egitim amacli gelistirilmistir.
