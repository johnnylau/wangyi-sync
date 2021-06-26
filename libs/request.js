import {chooseUserAgent} from './agent';

export async function sendRequest() {
    return new Promise((resolve, reject) => {
        let headers = { 'User-Agent': chooseUserAgent(options.ua) }
        if (method.toUpperCase() === 'POST')
          headers['Content-Type'] = 'application/x-www-form-urlencoded'
        if (url.includes('music.163.com'))
          headers['Referer'] = 'https://music.163.com'
        if (options.realIP) headers['X-Real-IP'] = options.realIP
          headers['X-Real-IP'] = '118.88.88.88'
        if (typeof options.cookie === 'object')
          headers['Cookie'] = Object.keys(options.cookie)
            .map(
              (key) =>
                encodeURIComponent(key) +
                '=' +
                encodeURIComponent(options.cookie[key]),
            )
            .join('; ')
        else if (options.cookie) headers['Cookie'] = options.cookie
    
        if (!headers['Cookie']) {
          headers['Cookie'] = options.token || ''
        }
        if (options.crypto === 'weapi') {
          let csrfToken = (headers['Cookie'] || '').match(/_csrf=([^(;|$)]+)/)
          data.csrf_token = csrfToken ? csrfToken[1] : ''
          data = encrypt.weapi(data)
          url = url.replace(/\w*api/, 'weapi')
        } else if (options.crypto === 'linuxapi') {
          data = encrypt.linuxapi({
            method: method,
            url: url.replace(/\w*api/, 'api'),
            params: data,
          })
          headers['User-Agent'] =
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36'
          url = 'https://music.163.com/api/linux/forward'
        } else if (options.crypto === 'eapi') {
          const cookie = options.cookie || {}
          const csrfToken = cookie['__csrf'] || ''
          const header = {
            osver: cookie.osver, //系统版本
            deviceId: cookie.deviceId, //encrypt.base64.encode(imei + '\t02:00:00:00:00:00\t5106025eb79a5247\t70ffbaac7')
            appver: cookie.appver || '8.0.0', // app版本
            versioncode: cookie.versioncode || '140', //版本号
            mobilename: cookie.mobilename, //设备model
            buildver: cookie.buildver || Date.now().toString().substr(0, 10),
            resolution: cookie.resolution || '1920x1080', //设备分辨率
            __csrf: csrfToken,
            os: cookie.os || 'android',
            channel: cookie.channel,
            requestId: `${Date.now()}_${Math.floor(Math.random() * 1000)
              .toString()
              .padStart(4, '0')}`,
          }
          if (cookie.MUSIC_U) header['MUSIC_U'] = cookie.MUSIC_U
          if (cookie.MUSIC_A) header['MUSIC_A'] = cookie.MUSIC_A
          headers['Cookie'] = Object.keys(header)
            .map(
              (key) =>
                encodeURIComponent(key) + '=' + encodeURIComponent(header[key]),
            )
            .join('; ')
          data.header = header
          data = encrypt.eapi(options.url, data)
          url = url.replace(/\w*api/, 'eapi')
        }
    
        const answer = { status: 500, body: {}, cookie: [] }
        let settings = {
          method: method,
          url: url,
          headers: headers,
          data: queryString.stringify(data),
          httpAgent: new http.Agent({ keepAlive: true }),
          httpsAgent: new https.Agent({ keepAlive: true }),
        }
    
        if (options.crypto === 'eapi') settings.encoding = null
    
        if (options.proxy) {
          if (options.proxy.indexOf('pac') > -1) {
            settings.httpAgent = new PacProxyAgent(options.proxy)
            settings.httpsAgent = new PacProxyAgent(options.proxy)
          } else {
            const purl = qs.parse(options.proxy)
            if (purl.hostname) {
              const agent = tunnel.httpsOverHttp({
                proxy: {
                  host: purl.hostname,
                  port: purl.port || 80,
                },
              })
              settings.httpsAgent = agent
              settings.httpAgent = agent
              settings.proxy = false
            } else {
              console.error('代理配置无效,不使用代理')
            }
          }
        }
        if (options.crypto === 'eapi') {
          settings = {
            ...settings,
            responseType: 'arraybuffer',
          }
        }
        axios(settings)
          .then((res) => {
            const body = res.data
            answer.cookie = (res.headers['set-cookie'] || []).map((x) =>
              x.replace(/\s*Domain=[^(;|$)]+;*/, ''),
            )
            try {
              if (options.crypto === 'eapi') {
                answer.body = JSON.parse(encrypt.decrypt(body).toString())
              } else {
                answer.body = body
              }
    
              answer.status = answer.body.code || res.status
              if (
                [201, 302, 400, 502, 800, 801, 802, 803].indexOf(answer.body.code) >
                -1
              ) {
                // 特殊状态码
                answer.status = 200
              }
            } catch (e) {
              // console.log(e)
              try {
                answer.body = JSON.parse(body.toString())
              } catch (err) {
                // console.log(err)
                // can't decrypt and can't parse directly
                answer.body = body
              }
              answer.status = res.status
            }
    
            answer.status =
              100 < answer.status && answer.status < 600 ? answer.status : 400
            if (answer.status === 200) resolve(answer)
            else reject(answer)
          })
          .catch((err) => {
            answer.status = 502
            answer.body = { code: 502, msg: err }
            reject(answer)
          })
      })
}