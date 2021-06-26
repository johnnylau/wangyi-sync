const crypto = require('crypto');
const {
    WANGYI_USERNAME: username,
    WANGYI_PWD: password
} = process.env;

const RECOMMEND_SONGS_ENDPOINT = `https://music.163.com/api/v3/discovery/recommend/songs`;
const PHONE_LOGIN_ENDPOINT = `https://music.163.com/weapi/login/cellphone`;

export async function getRecommendSongs (query, request) {
    query.cookie.os = 'ios'
  const data = {}
  return request(
    'POST',
    `https://music.163.com/api/v3/discovery/recommend/songs`,
    data,
    {
      crypto: 'weapi',
      cookie: query.cookie,
      proxy: query.proxy,
      realIP: query.realIP,
    },
  )
}

const login = async(query, request) => {
    const data = {
        phone: query.phone,
        countrycode: '86',
        password: query.md5_password || crypto.createHash('md5').update(password).digest('hex')
    }

    const options = {
        crypto: 'weapi',
        ua: 'pc',
        cookie: query.cookie,
        proxy: query.proxy,
        realIP: query.realIP
    }

    let result = await request('POST', PHONE_LOGIN_ENDPOINT, data, options);

    if(result.body.code === 200) {
        result = {
            status: 200,
            body: {
                ...result.body,
                cookie: result.cookie.join(';'),
            },
            cookie: result.cookie
        }
    }

    return result;
}