# Кабинет

Расширение SillyTavern: своя панель (Вид · Мир · Пресет · Дни), режим чтения, кнопки у поля ввода.

Это снимок версии 0.2.4 с сервера (05.11.2026), ещё без изменений. Дальше сюда переедет CSS тем
«Кабинет · Ночь» и «Кабинет · Бумага». Сейчас он лежит в настройках ST как custom CSS, поэтому
его не видно в git и его нельзя выключить вместе с расширением.

## Установка с сервера (Termius)

```
docker exec sillytavern sh -c 'cd /home/node/app/data/default-user/extensions && mv kabinet kabinet.bak && git clone https://github.com/clarawill137/kabinet kabinet'
```

Обновить: `docker exec sillytavern sh -c 'cd /home/node/app/data/default-user/extensions/kabinet && git pull'`
