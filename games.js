window.ElheliheyGames = {
  async mount(id, request) {
    const root = document.getElementById(id);
    const panel = document.createElement('section');
    root.replaceChildren(panel);
    function text(tag, value) {
      const el = document.createElement(tag);
      el.textContent = value;
      panel.append(el);
      return el;
    }
    function button(label, run) {
      const el = text('button',label);
      el.type = 'button';
      el.className = 'btn btn-primary';
      el.addEventListener('click',run);
    }
    function menu(){return window.ElheliheyGames.mount(id,request);}
    text('p','جارٍ تحميل الألعاب…');
    try {
      const hub=await request('getGamesHub',{});
      if (!hub.success) throw new Error(hub.message || 'تعذر تحميل الألعاب');
      panel.replaceChildren();
      text('h2',hub.season.seasonName || 'الألعاب التعليمية');
      if (!hub.customGames.length) text('p','لا توجد ألعاب منشورة لمجموعتك حاليًا.');
      for (const game of hub.customGames) button(game.title,()=>play(game,[]));
    } catch(error) {
      panel.replaceChildren();text('p',error.message);button('إعادة التحميل',menu);
    }
    function play(game,answers){
      panel.replaceChildren();
      const q=game.questions[answers.length];
      text('h3',game.title);
      text('p',q.q);
      q.options.forEach((label,index)=>button(label,async()=>{
        const updated=[...answers,index];
        if(updated.length<game.questions.length){play(game,updated);return;}
        panel.replaceChildren();text('p','جارٍ حفظ النتيجة…');
        try {
          const result=await request('submitGameResult',{gameId:game.id,answers:updated});
          if(!result.success)throw new Error(result.message || 'تعذر تسجيل النتيجة');
          panel.replaceChildren();text('p','الإجابات الصحيحة '+result.accuracy+'٪');
        } catch(error){panel.replaceChildren();text('p',error.message);}
        button('العودة إلى الألعاب',menu);
      }));
    }
  }
};
