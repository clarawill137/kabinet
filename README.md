# Кабинет

Расширение SillyTavern: своя панель (Вид · Мир · Пресет · Дни), режим чтения, кнопки у поля ввода
и скин тем «Кабинет · Ночь» / «Кабинет · Бумага».

## Скин (с 0.3.0)

Раньше CSS тем Кабинета (около 24 тысяч символов) лежал в custom CSS настроек ST, то есть в settings.json и в файлах тем.
Теперь он лежит здесь:

- `skin/base.css` — общая часть: шрифты, иконки топ-бара, сообщения, панели, кнопки, поля;
- `skin/night.css`, `skin/paper.css` — только цвета.

Расширение подключает их само, когда в ST выбрана тема «Кабинет · Ночь» или «Кабинет · Бумага».
Если выбрана любая другая тема, скина нет. Если расширение выключено, скина тоже нет.

При первом запуске 0.3.0 расширение убирает старый CSS из настроек ST и из файлов этих двух тем на сервере.
Цвета и остальные настройки тем остаются. Оригиналы тем, как они были до переезда, лежат в `legacy/`.

## Установка с сервера (Termius)

```
docker exec sillytavern sh -c 'cd /home/node/app/data/default-user && rm -rf kabinet.bak && mv extensions/kabinet kabinet.bak && git clone https://github.com/clarawill137/kabinet extensions/kabinet'
```

Старая папка уезжает в `default-user/kabinet.bak`, за пределы `extensions`. Если оставить её внутри, ST загрузит её как второе расширение.

Обновить: `docker exec sillytavern sh -c 'cd /home/node/app/data/default-user/extensions/kabinet && git pull'`

## Откат

```
docker exec sillytavern sh -c 'cd /home/node/app/data/default-user && cp extensions/kabinet/legacy/*.json themes/ && rm -rf extensions/kabinet && mv kabinet.bak extensions/kabinet'
```

Команда возвращает файлы тем со старым CSS и старую версию расширения. Потом обнови страницу и заново выбери тему.
