var async = require("asyncawait/async");
var await=require("asyncawait/await");
var e = require("../../util/error.json");
var util = require("../../util/util");
var userCom=require("./userCommon");
var user=require("../../model/userModel");
var ldap = require("ldapjs");
var config = require("../../../config.json");


function UserLdap() {
    // https://www.cnblogs.com/kongxianghai/p/4847265.html    

    this.login = async((req, res) => {
        try {
            var uname = req.clientParam.name;
            var pwd = req.clientParam.password;
            var opts = {
                filter: `(cn=${uname})`,
                scope: 'sub',
                timeLimit: 1000
            };

            //创建LDAP client，把服务器url传入
            var client = ldap.createClient({
                url: config.ldap.url
            });

            client.bind(config.ldap.username, config.ldap.password, function (err, res1) {
                console.log('ldap search options:', opts);
                client.search(config.ldap.base, opts, function (err, res2) {
                    var isFound = false;
                    var isErr = false;
                    //查询结果事件响应
                    res2.on('searchEntry', async(function (entry) {
                        try {
                            isFound = true;
                        //获取查询的对象
                        var user1 = entry.object;
                        var userText = JSON.stringify(user1, null, 2);
                        // console.log(userText);

                        if (user1) {
                            if (pwd !== user1.userPassword) {
                                util.throw(e.userOrPwdWrong, "用户名或者密码错误");
                            }
                        }

                        let obj={
                            name: user1.cn,
                            password: user1.userPassword,
                            qqId:'1',
                            question:'1',
                            answer:'1',
                            email:user1.mail
                        };

                        let ret=await (user.findOneAsync({
                            name:obj.name
                        }));
                        if(ret) {
                            // util.throw(e.duplicateUser,"用户名重复");
                            // 更新用户密码
                        } else {
                            // 创建一个用户
                            obj=await (user.createAsync(obj));
                        }

                        // 登录
                        var userCommon = new userCom();
                        obj= await (userCommon.updateUser(req.clientParam.name,req.clientParam.password));
                        if (obj) {
                            if (obj.state==1) {
                                req.session.userid=obj._id;
                                util.ok(res,obj,"ok");
                            } else {
                                util.throw(e.userForbidden,"用户被禁用");
                            }
                        } else {
                            util.throw(e.userOrPwdWrong,"用户名或者密码错误");
                        }
                        } catch (err) {
                            util.catch(res, err);
                        }
                    }));

                    res2.on('searchReference', function (referral) {
                        console.log('referral: ' + referral.uris.join());
                    });

                    //查询错误事件
                    res2.on('error', function (err) {
                        console.error('error: ' + err.message);
                        isErr = true;
                        // util.throw(e.userOrPwdWrong, "用户名或者密码错误");
                        if (!isFound) {
                            util.err(res, 400, '用户名或者密码错误');
                        }
                        //unbind操作，必须要做
                        client.unbind();
                    });

                    //查询结束
                    res2.on('end', function (result) {
                        console.log('search status: ' + result);
                        // util.throw(e.userOrPwdWrong, "用户名或者密码错误");
                        if (!isFound && !isErr) {
                            util.err(res, 400, '用户名或者密码错误');
                        }
                        //unbind操作，必须要做
                        client.unbind();
                    });
                });
            });

        } catch (err) {
            util.catch(res, err);
        }
    });
}

module.exports = UserLdap;