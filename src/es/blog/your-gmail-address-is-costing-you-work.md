---
blogTitle: Su dirección de Gmail le está costando trabajo sin que lo note
pageName: your-gmail-address-is-costing-you-work
titleTag: Por qué su negocio necesita correo en su propio dominio
blogDescription: >-
  Una cotización que llega de sunegocio@gmail.com y una que llega de
  hola@sunegocio.com se leen distinto, y la segunda además tiene muchas más
  probabilidades de llegar a la bandeja de entrada. Cuánto cuesta de verdad el
  correo con dominio propio, para qué sirven SPF, DKIM y DMARC, y en qué orden
  hacer la migración sin perder correos.
author: Joseph C.
date: 2026-01-25T14:04:00.000Z
topper: Estrategia
image: /assets/images/your-gmail-address-is-costing-you-work-photo.jpg
imageAlt: Un escritorio visto desde arriba con teclado, teléfono, libreta y audífonos
draft: false
tags:
  - post-es
  - strategy
  - email
  - domain
  - deliverability
  - trust
  - small-business
tldrTitle: En resumen
tldr:
  - >-
    El correo con dominio propio cuesta más o menos lo mismo que un par de cafés
    al mes por buzón: hace una década que dejó de ser una decisión de costo.
  - >-
    Mandar correo de negocio desde una dirección de correo gratuito significa que
    no lo puede autenticar, y eso cada vez más significa que no llega.
  - >-
    SPF, DKIM y DMARC son tres registros DNS. Se configuran una sola vez.
  - >-
    Migre en este orden: agregar el dominio → autenticar → reenviar la dirección
    vieja → cambiarla en todas partes → dejar de usar la vieja. Nunca borre
    primero.
faq:
  - q: ¿De verdad hace tanto daño una dirección de correo gratuito?
    a: >-
      Son dos problemas distintos con un mismo disfraz. El primero es de
      percepción: una cotización que llega de una dirección de Gmail se lee como
      un trabajo de fin de semana, sea justo o no, y esa impresión no le cuesta
      nada quitársela. El segundo es mecánico y peor: el correo masivo y
      transaccional que se manda en su nombre no se puede autenticar contra un
      dominio que usted no controla, así que se filtra más. El problema de
      percepción se puede discutir. El de entrega, no.
  - q: ¿Qué hacen exactamente SPF, DKIM y DMARC?
    a: >-
      SPF es un registro DNS que enumera qué servidores tienen permitido mandar
      correo usando su dominio. DKIM le pone a cada mensaje una firma
      criptográfica que el destinatario puede verificar contra una llave pública
      publicada en su DNS. DMARC amarra las dos cosas: le dice a los servidores
      que reciben qué hacer cuando un mensaje no pasa esas verificaciones, y a
      dónde mandar los reportes. Los grandes proveedores de correo pasaron de
      tratarlos como opcionales a tratarlos como un requisito para quien manda en
      volumen.
  - q: Ya tengo un dominio para mi sitio web. ¿Necesito otro para el correo?
    a: >-
      No. El correo y el hosting web son servicios separados que apuntan al mismo
      dominio con registros DNS distintos: los registros MX enrutan el correo, y
      los registros A y CNAME enrutan el tráfico web. Su sitio puede estar con un
      proveedor y su correo con otro, en el mismo dominio, sin conflicto.
  - q: ¿Puedo simplemente reenviar la dirección de mi dominio a mi Gmail actual?
    a: >-
      Para recibir, sí, y es un buen primer paso. Para mandar, es una trampa: las
      respuestas salen desde la dirección de Gmail, así que los clientes guardan
      la dirección equivocada en su libreta y el problema de percepción nunca se
      va. El reenvío además rompe la alineación de SPF en el salto reenviado, lo
      que puede afectar la entrega. Use el reenvío como red de seguridad durante
      la migración, no como destino final.
  - q: ¿Qué pasa con años de correos viejos si me cambio?
    a: >-
      Nada, si lo hace en el orden correcto. Tanto Google Workspace como
      Microsoft 365 tienen herramientas de importación que copian correo,
      contactos y calendario de una cuenta existente al buzón nuevo. La regla que
      lo protege es sencilla: nunca cierre ni borre la cuenta vieja hasta que la
      nueva lleve recibiendo bien al menos un ciclo completo de facturación.
  - q: ¿Cuántos buzones necesita de verdad un negocio pequeño?
    a: >-
      Normalmente menos de los que la gente compra. Un buzón de pago por cada
      persona que manda correo, más alias gratuitos para las direcciones de
      función —<code>info@</code>, <code>facturacion@</code>,
      <code>empleo@</code>— dirigidos a una persona real. Los alias no cuestan
      nada en ninguna de las dos plataformas principales. Una empresa de tres
      personas casi siempre necesita tres buzones y cinco alias, no ocho buzones.
sources:
  - label: Ayuda de administración de Google Workspace — Evitar la suplantación y el spam con SPF
    url: https://support.google.com/a/answer/33786
  - label: RFC 6376 — Firmas DomainKeys Identified Mail (DKIM)
    url: https://www.rfc-editor.org/rfc/rfc6376
  - label: RFC 7489 — Autenticación, reporte y conformidad de mensajes basada en dominio (DMARC)
    url: https://www.rfc-editor.org/rfc/rfc7489
  - label: Ayuda de Gmail — Directrices para remitentes
    url: https://support.google.com/mail/answer/81126
readMins: 7
category: Estrategia
---

## Dos cotizaciones, el mismo precio

Un dueño de casa recibe dos presupuestos para el mismo trabajo la misma tarde.

Uno llega de `climasdedave1987@gmail.com`. El otro, de `dave@climasdedave.com`. Los mismos números, el mismo alcance, la misma persona.

Nadie hace un juicio consciente sobre esto. No es una decisión que alguien defendería en voz alta. Pero el segundo se lee como una empresa y el primero se lee como un señor, y esa diferencia cuesta unos seis dólares al mes borrarla para siempre.

Esa es la mitad blanda del argumento, y es la mitad que la gente ya conoce. La mitad dura es la que cambió hace poco, y es la razón por la que esto dejó de ser una preferencia y se volvió infraestructura.

## La parte que de verdad se rompe

Los proveedores de correo llevan varios años apretando lo que aceptan. La dirección del cambio no deja dudas: el correo que no se puede autenticar contra el dominio del que dice venir se filtra, y el umbral se sigue moviendo hacia «obligatorio».

La autenticación es una afirmación sobre un **dominio**. Funciona publicando registros DNS bajo un dominio que usted controla, diciendo qué servidores pueden mandar en su nombre y cómo verificar la firma de un mensaje. Usted no puede publicar registros DNS bajo `gmail.com`. Google sí. Usted no.

Esto importa en tres lugares concretos del sitio de un negocio pequeño:

**Su formulario de contacto.** Casi todos los formularios mandan una notificación a usted y una respuesta automática al cliente. Si esos mensajes dicen venir de su dominio pero los mandan los servidores de su proveedor de formularios, necesitan registros SPF y DKIM bajo su dominio para que se confíe en ellos. Sin dominio no hay registros, y más de esas confirmaciones caen en spam.

**Sus facturas y confirmaciones de cita.** El mismo mecanismo, con más en juego. Una factura que cae en silencio en la carpeta de correo no deseado es una factura sin pagar y una conversación de seguimiento que empieza con una disculpa.

**Cualquier lista a la que le mande correo.** Un boletín, un recordatorio de temporada, un aviso de «nos mudamos». Mandar en volumen sin autenticación es la forma más rápida de terminar filtrado.

Nada de eso se arregla escribiendo mejores asuntos. Se arregla siendo dueño del dominio del que el correo dice venir.

## Cuánto cuesta

Dos opciones principales, las dos en el mismo rango:

- **Google Workspace**: la misma interfaz de Gmail que ya conoce, con su propio dominio, por usuario al mes.
- **Microsoft 365**: Outlook más las aplicaciones de Office, por usuario al mes.

Las dos incluyen el buzón, el calendario, el almacenamiento y, más importante, generan los registros DNS que necesita. Las dos le dejan crear alias ilimitados sin costo extra, que es como consigue `info@`, `facturacion@` y `empleo@` sin pagar tres buzones.

Hay opciones más baratas: casi todos los registradores venden un buzón básico, y algunos planes de [hosting](/es/hosting-and-domains/) incluyen uno. Funcionan. Normalmente son peores filtrando spam y sincronizando con el celular, y la experiencia de soporte cuando el correo deja de fluir no es comparable. Para un negocio donde el correo *es* el canal de ventas, la opción principal vale la diferencia.

Los precios cambian, así que no vamos a citar cifras actuales aquí. Lo relevante es que esto lleva por lo menos una década sin ser una decisión de costo de verdad. Es una decisión que la gente pospone, no una que no pueda pagar.

## Los tres registros DNS

Los va a configurar una sola vez, en su registrador o donde esté alojado su DNS, y después no va a volver a pensar en ellos. Su proveedor genera los valores exactos; esto es para qué sirven.

**SPF**: un registro `TXT` que enumera qué servidores tienen permitido mandar correo usando su dominio. Un registro, una línea. El error más común es tener dos registros SPF, lo cual es inválido; si después agrega otro remitente, lo integra al registro existente en lugar de publicar uno nuevo.

**DKIM**: un registro `TXT` que contiene una llave pública. Su proveedor firma cada mensaje saliente con la llave privada correspondiente, y los servidores que reciben verifican la firma. Esto es lo que prueba que un mensaje no fue alterado y que de verdad vino de un remitente autorizado.

**DMARC**: un registro `TXT` en `_dmarc.sudominio.com` que hace dos cosas: le dice a los servidores que reciben qué hacer con el correo que no pasa SPF y DKIM, y le da una dirección donde recibir reportes.

Empiece DMARC en `p=none`. Eso significa «verifica, reporta, pero no rechaces». Lea los reportes durante unas semanas para encontrar todos los sistemas que legítimamente mandan como usted —su proveedor de formularios, su herramienta de facturación, su sistema de citas— y autentíquelos todos. Solo después apriete a `p=quarantine` y con el tiempo a `p=reject`.

Irse directo a `p=reject` antes de haber hecho el inventario de sus remitentes es la forma en que los negocios descubren que su plataforma de facturación nunca estuvo autenticada: con un mes de facturas rebotadas.

## El orden de migración que no pierde correos

El orden importa más que las herramientas. Hágalo en esta secuencia:

1. **Agregue el dominio a su nuevo proveedor y verifíquelo.** Todavía no cambia nada para nadie; solo está comprobando que es suyo.
2. **Cree los buzones y los alias.** Decida la convención de nombres ahora: `nombre@` para las personas, alias de función para los roles. Cambiarla después significa reimprimir cosas.
3. **Publique SPF, DKIM y DMARC.** La propagación del DNS suele tardar minutos, a veces horas. Verifique con el propio verificador de su proveedor antes de seguir.
4. **Cambie los registros MX.** Este es el momento en que el correo nuevo empieza a llegar al buzón nuevo. Todo lo anterior era reversible sin que nadie se diera cuenta.
5. **Importe el correo viejo.** Las dos plataformas tienen una herramienta de importación. Córrala después del cambio, para no estar importando un blanco en movimiento.
6. **Ponga la dirección vieja a reenviar** a la nueva, y déjela reenviando durante meses. Esa es su red de seguridad para cada proveedor, portal y cliente que todavía tenga la dirección vieja registrada.
7. **Actualice la dirección en todas partes**: el sitio web, el Perfil de Empresa en Google, las facturas, las plantillas de cotización, la rotulación de los vehículos, las tarjetas de presentación, los directorios, los perfiles de redes sociales. Trátelo igual que un cambio de número de teléfono.
8. **Deje de mandar desde la dirección vieja.** No la borre: solo deje de usarla como remitente, para que los clientes dejen de aprendérsela.

La cuenta que nunca cierra es la que lo salva. Hemos visto a un negocio perder dos años de correspondencia con proveedores por borrar una cuenta de correo gratuito la misma semana de la migración, porque la importación había fallado en silencio en una carpeta que nadie revisó.

## La parte que la gente se salta

Configure una firma decente en cada buzón, incluido el celular.

Una firma con su nombre, su puesto, el nombre del negocio, el teléfono como enlace para marcar y la dirección del sitio hace dos cosas útiles. Convierte cada respuesta en una pequeña pieza de marca, y le da al destinatario una forma de llamarlo con un solo toque desde el mensaje que ya está leyendo. El clásico «Enviado desde mi iPhone» es una línea desperdiciada en todos los mensajes que va a mandar en su vida.

Ya que anda ahí, revise cómo se ve su nombre. Que `dave@climasdedave.com` aparezca como «dave» en la bandeja de alguien es una versión pequeña del mismo problema que acaba de pagar por arreglar.

## ¿Vale toda una tarde?

Siendo honestos: el cambio de percepción es real pero no se puede medir, y no le pediríamos a nadie que migrara solo por eso.

El cambio en la entrega sí se mide, y se está poniendo más estricto, no más relajado. Si sus cotizaciones, sus facturas y las confirmaciones de sus formularios los mandan en su nombre sistemas de terceros —y en casi cualquier sitio moderno así es—, entonces el dominio que no puede autenticar es una debilidad estructural justo en la parte de su negocio que convierte el interés en dinero.

Es una tarde, una sola vez. Hágalo antes de la próxima cosa que dependa de que el correo funcione.
