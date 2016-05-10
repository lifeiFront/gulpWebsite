"use strict";
var gulp = require("gulp");
var through = require("through2"); //流转换工具
/**
 * [minifyAndComboCSS css压缩合并方法]
 * @param  {[字符串]} name   [压缩合并后的样式文件名]
 * @param  {[字符串]} encode [编码方式]
 * @param  {[数组]} files  [文件数组（html文件中的相对引用路径）]
 * @return {[type]}        [默认]
 */
function minifyAndComboCSS(name, encode, files) {
	var fs = require("fs"); //文件流处理模块
	var CleanCSS = require("clean-css"); //样式压缩模块
	var content = ""; //合并后的样式存放

	files.forEach(function(css) { //循环页面引入的样式文件
		var contents = fs.readFileSync(css, encode); //同步读取文件内容
		var minified = new CleanCSS().minify(contents).styles; //压缩样式文件
		content += minified;
	});

	if (content) {
		var combo = "mincss/" + name;
	}
	//注意：writeFileSync 方法写入时，路径中的文件夹必须存在，否则无法写入文件
	fs.writeFileSync(combo, content);

	gulp.src(combo)
		.pipe(gulp.dest("./dist/static/css")); //注意：gulp.dest路径中不存在的文件夹会自动创建
}
/**
 * [minifyAndComboJS js压缩合并方法]
 * @param  {[字符串]} name   [压缩合并后的js文件名]
 * @param  {[字符串]} encode [编码方式]
 * @param  {[数组]} files  [文件路径数组（html文件中的相对引用路径）]
 * @return {[type]}        [description]
 */
function minifyAndComboJS(name, encode, files) {
	var fs = require("fs");
	var UglifyJS = require("uglify-js");//js压缩模块
	var content = "";

	files.forEach(function(js) {//压缩合并js
		var minified = UglifyJS.minify(js).code;
		content += minified;
	});

	if (content) {
		var combo = "minjs/" + name;
	}
	fs.writeFileSync(combo, content);//将压缩合并后的js写入根目录下的minjs/文件夹下

	gulp.src(combo)
		.pipe(gulp.dest("./dist/static/js"));
}


gulp.task("build-index", ["build-js-lib", "build-common-css"], function() {
	gulp.src("./index.html")
		.pipe(through.obj(function(file, encode, cb) {//
			var fs = require("fs");
			var contents = file.contents.toString(encode);
			var $ = require("cheerio").load(contents, {//服务器端类jQuery模块
				decodeEntities: false
			});

			//处理外链 css 获取html文件中的样式引用路径
			var links = $("link");
			var cssToCombo = [];

			for (var i = 0; i < links.length; i++) {

				var link = $(links[i]);
				if (link.attr("rel") === "stylesheet") {
					var href = link.attr("href");
					if (/^css\//.test(href)) {//正则效验可自行修改
						cssToCombo.push(href);
						if (cssToCombo.length == 1) {//纯在样式引用
							link.attr("href", "static/css/index.min.css");//将html中的第一个引用改成压缩合并后自定义的名字
						} else {
							link.remove();//将其他的样式引用移除掉（因为引用的样式均合并到同一个样式文件中了）
						}
					}
				}
			}
			minifyAndComboCSS("index.min.css", encode, cssToCombo);

			//处理外链 js  原理与css处理逻辑一致
			var scripts = $("script");
			var jsToCombo = [];
			for (var i = 0; i < scripts.length; i++) {
				var s = $(scripts[i]);

				//判断script标签确实是js
				if (s.attr("type") == null || s.attr("type") === "text/javascript") {
					var src = s.attr("src");

					if (src) {
						//外链的js
						if (/^js\//.test(src)) {
							jsToCombo.push(src);
							if (jsToCombo.length == 1) {
								s.attr("src", "static/js/index.min.js");
							} else {
								s.remove();
							}
						}
					}
				}
			}
			minifyAndComboJS("index.min.js", encode, jsToCombo);

			//处理内联图片
			var imgs = $("img");
			for (var i = 0; i < imgs.length; i++) {
				var img = $(imgs[i]);
				var src = img.attr("src");
				if (/^static\/img/.test(src)) {
					var stat = fs.statSync(src);
					var ext = require("path").parse(src).ext;

					if (stat.size <= 3000) {
						var head = ext === ".png" ? "data:image/png;base64," : "data:image/jpeg;base64,";
						var datauri = fs.readFileSync(src).toString("base64");
						img.attr("src", head + datauri);
					}
				}
			}

			contents = $.html();

			//压缩 HTML  html压缩模块
			var HTMLMinifier = require("html-minifier").minify;

			var minified = HTMLMinifier(contents, {
				minifyCSS: true,
				minifyJS: true,
				collapseWhitespace: true,
				removeAttributeQuotes: true
			});

			file.contents = new Buffer(minified, encode);
			cb(null, file, encode);
		}))
		.pipe(gulp.dest("./dist"));//将html压缩处理后写入dist目录。注意：压缩合并后的js、css文件也要放到对应的目录。保证压缩后的html中的相对引用路径正确
});

gulp.task("build-js-lib", function() {//压缩js文件
	gulp.src("./js/*.js")
		.pipe(through.obj(function(file, encode, cb) {
			var UglifyJS = require("uglify-js");

			var contents = file.contents.toString(encode);
			var minified = UglifyJS.minify(contents, {
				fromString: true
			}).code;

			file.contents = new Buffer(minified, encode);
			cb(null, file, encode);
		}))
		.pipe(gulp.dest("./dist/js"));
});

gulp.task("build-common-css", function() {//压缩样式文件路径
	gulp.src("./css/*.css")
		.pipe(through.obj(function(file, encode, cb) {
			var CleanCSS = require("clean-css");

			var contents = file.contents.toString(encode);
			var minified = new CleanCSS().minify(contents).styles;

			file.contents = new Buffer(minified, encode);
			cb(null, file, encode);
		}))
		.pipe(gulp.dest("./dist/css"));
});
