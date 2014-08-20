#!/usr/bin/env ruby

module Annotation
  def Annotation.render_text_annotation (text, annotation)
    rendering = ''
    last = 0
    annotation.each do |b, e, l|
      l ||= 'span'
      rendering += text[last...b]
      rendering += "<span class='#{l}'>"
      rendering += text[b...e]
      rendering += '</span>'
      last = e
    end
    rendering += text[last..-1]
  end
end

if __FILE__ == $0
  a = Annotation.render_text_annotation("01234ABC89", [[1, 3], [5, 8, 'label']])
  p a
end