var cpos = {
    x: 0,
    y: 0,
    scale: 0,
    swidth: 0,
    sheight: 0,
    min_scale: 0,
    max_scale: 5,
    nohide: false,
};
var viewport = {
    width: 0,
    height: 0
};
var dragging = false;
var last_coord = {
    x: 0,
    y: 0
};
var first_coord = {
    x: 0,
    y: 0
};
var svg;
var pinch_scale = 1;

$('document').ready(function () {
    var viewer = $('#viewer');
    //viewer.css("height",$(window).height())
    svg = $('svg');

    var [stop, sleft, swidth, sheight] = svg.attr('viewBox').split(' ');
    cpos.swidth = swidth;
    cpos.sheight = sheight;

    viewport.width = viewer.width();
    viewport.height = viewer.height();

    // custom sizing
    // want ground plane to be aligned to middle of viewport, with top of tree at top of screen

    var view_distance = viewport.height / 2;
    var scale = view_distance / 900;
    cpos.scale = scale;

    var min_scale_x = viewport.width / cpos.swidth;
    var min_scale_y = viewport.height / cpos.sheight;
    cpos.min_scale = min_scale_x > min_scale_y ? min_scale_x : min_scale_y;

    cpos.x = (viewport.width - scale * swidth) / 2;

    svg.css('left', cpos.x);
    svg.css('width', scale * swidth);
    svg.css('height', scale * sheight);

    viewer.on('mousedown touchstart', beginDrag);
    $(window).on('mouseup touchend', endDrag);
    $(window).on('mousemove touchmove', doDrag);

    viewer.on('dblclick', zoomOnPoint);
    viewer.on('gesturestart', beginPinch);
    viewer.on('gesturechange', doPinch);
    viewer.on('wheel', doWheel);

    $('#intro,#whiteout').on('mouseup touchend', function () {
        $('#intro,#whiteout').fadeOut();
    });

    renderNotes();
    renderCalendar();

    $('.shipped,.calendar').on('touchstart', function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    });

    $('.shipped').on('touchend mouseup', function (evt) {
        $('#released').toggleClass('show');
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    });

    $('.calendar').on('touchend mouseup', function (evt) {
        $('#calendar').toggleClass('show');
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    });

    $('.close').on('touchend mouseup', function (evt) {
        $(this)
            .parent()
            .removeClass('show');
        evt.preventDefault();
        evt.stopPropagation();
        return false;
    });

    $('svg .feature').on('click touchend', function (evt) {
        evt.preventDefault();
        evt.stopPropagation();

        //var feature = $(this).offset()
        //$("#debug").html(.left)

        // bail out if large move distance (only detect taps)
        //var now_coord = {x:evt.pageX ? evt.pageX : evt.touches[0].pageX , y:evt.pageY ? evt.pageY : evt.touches[0].pageY }
        var offset = {
            x: last_coord.x - first_coord.x,
            y: last_coord.y - first_coord.y,
        };
        if (Math.abs(offset.x) > 2 || Math.abs(offset.y) > 2) return false;

        var el = $(this).attr('id');
        var card = getCard(el);

        renderCard(card);
        $('#popup')
            .css({
                left: last_coord.x - 10,
                top: last_coord.y - 180
            })
            .show();

        return false;
    });
});

function beginPinch(evt) {
    //$("#debug").html(evt.originalEvent.scale)
    pinch_scale = cpos.scale;
    evt.preventDefault();
}

function doPinch(evt) {
    zoomOnPointWithScale(viewport.width / 2, viewport.height / 2, pinch_scale * evt.originalEvent.scale);
    evt.preventDefault();
}

function beginDrag(evt) {
    last_coord = first_coord = {
        x: evt.pageX ? evt.pageX : evt.touches[0].pageX,
        y: evt.pageY ? evt.pageY : evt.touches[0].pageY,
    };
    dragging = true;

    evt.preventDefault();
}

function doDrag(evt) {
    if (!dragging) return;

    var now_coord = {
        x: evt.pageX ? evt.pageX : evt.touches[0].pageX,
        y: evt.pageY ? evt.pageY : evt.touches[0].pageY,
    };
    var offset = {
        x: now_coord.x - last_coord.x,
        y: now_coord.y - last_coord.y
    };
    last_coord = now_coord;

    if (Math.abs(first_coord.x - now_coord.x) > 2 || Math.abs(first_coord.y - now_coord.y) > 2) {
        cpos.nohide = true;
    }

    cpos.x += offset.x;
    cpos.y += offset.y;

    var poppos = $('#popup').position();
    $('#popup').css({
        left: poppos.left + offset.x,
        top: poppos.top + offset.y
    });

    // clamp svg to viewport
    if (cpos.swidth * cpos.scale > viewport.width) {
        if (cpos.x > 0) cpos.x = 0;
        if (cpos.x + cpos.swidth * cpos.scale < viewport.width) cpos.x = viewport.width - cpos.swidth * cpos.scale;
    } else {
        if (cpos.x < 0) cpos.x = 0;
        if (cpos.x + cpos.swidth * cpos.scale > viewport.width) cpos.x = viewport.width - cpos.swidth * cpos.scale;
    }

    if (cpos.sheight * cpos.scale > viewport.height) {
        if (cpos.y > 0) cpos.y = 0;
        if (cpos.y + cpos.sheight * cpos.scale < viewport.height) cpos.y = viewport.height - cpos.sheight * cpos.scale;
    } else {
        if (cpos.y < 0) cpos.y = 0;
        if (cpos.y + cpos.sheight * cpos.scale > viewport.height) cpos.y = viewport.height - cpos.sheight * cpos.scale;
    }

    // force redraw with hide().show(0)
    $(svg)
        .css({
            left: cpos.x,
            top: cpos.y
        })
        .hide()
        .show(0);

    evt.preventDefault();
    return false;
}

function endDrag(evt) {
    dragging = false;

    if (!cpos.nohide) {
        $('#popup').hide();
    }
    cpos.nohide = false;
}

function doWheel(evt) {
    // don't zoom while dragging
    if (dragging) return false;

    var deltaY = 0;

    if (evt.originalEvent.deltaY) {
        // FireFox 17+ (IE9+, Chrome 31+?)
        deltaY = -evt.originalEvent.deltaY;
    } else if (evt.originalEvent.wheelDelta) {
        deltaY = -evt.originalEvent.wheelDelta;
    }

    if (deltaY > 1) {
        deltaY = 1;
    } else if (deltaY < -1) {
        deltaY = -1;
    }

    var scale = cpos.scale + (cpos.scale * deltaY) / 20;

    zoomOnPointWithScale(evt.pageX, evt.pageY, scale);
    evt.preventDefault();
}

function zoomOnPoint(evt) {
    var level = cpos.scale + 1;
    zoomOnPointWithScale(evt.pageX, evt.pageY, level);
}

function zoomOnCenter() {
    var level = parseFloat($(this).val());
    zoomOnPointWithScale(viewport.width / 2, viewport.height / 2, level);
}

function zoomOnPointWithScale(x, y, scale) {
    if (scale < cpos.min_scale) scale = cpos.min_scale;
    if (scale > cpos.max_scale) scale = cpos.max_scale;

    var x_offset = x - ((x - cpos.x) / cpos.scale) * scale;
    var y_offset = y - ((y - cpos.y) / cpos.scale) * scale;

    //var new_x_offset = (viewport.width/2 - cpos.x) * level
    //var new_x_offset = (viewport.width/2 - cpos.x) * level

    cpos.scale = scale;
    cpos.x = x_offset;
    cpos.y = y_offset;

    // clamp svg to viewport
    if (cpos.swidth * cpos.scale > viewport.width) {
        if (cpos.x > 0) cpos.x = 0;
        if (cpos.x + cpos.swidth * cpos.scale < viewport.width) cpos.x = viewport.width - cpos.swidth * cpos.scale;
    } else {
        if (cpos.x < 0) cpos.x = 0;
        if (cpos.x + cpos.swidth * cpos.scale > viewport.width) cpos.x = viewport.width - cpos.swidth * cpos.scale;
    }

    if (cpos.sheight * cpos.scale > viewport.height) {
        if (cpos.y > 0) cpos.y = 0;
        if (cpos.y + cpos.sheight * cpos.scale < viewport.height) cpos.y = viewport.height - cpos.sheight * cpos.scale;
    } else {
        if (cpos.y < 0) cpos.y = 0;
        if (cpos.y + cpos.sheight * cpos.scale > viewport.height) cpos.y = viewport.height - cpos.sheight * cpos.scale;
    }

    svg.css({
        left: cpos.x,
        top: cpos.y,
        width: scale * cpos.swidth,
        height: scale * cpos.sheight,
    });
}
