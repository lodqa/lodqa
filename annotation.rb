#!/usr/bin/env ruby

module Annotation
  def Annotation.render_text_annotation (text, annotation)
    annotation2 = annotation.collect {|a| a.push('span') unless a[2]}
    rendering, last = '', 0
    annotation2.each do |b, e|
      label = 'span'
      rendering += text[last...b]
      rendering += "<span class='#{label}'>"
      rendering += text[b...e]
      rendering += '</span>'
      last = e
    end
    rendering += text[last..-1]
  end
end

if __FILE__ == $0
  a = Annotation.render_text_annotation("01234ABC89", [[5, 8]])
  p a
end