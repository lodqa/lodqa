#!/opt/local/bin/ruby
require 'cgi'
require 'erb'
#require '../ontotagger/nlptools/sentencer'
#require '../ontotagger/nlptools/enju'
require '/opt/services/ontotagger/nlptools/sentencer'
require '/opt/services/ontotagger/nlptools/enju'
#require './sparql'

cgi = CGI.new
text = cgi.params['query'][0]

enju = Enju.new("http://localhost:31200")
enju.parse(text)

head  = enju.get_head
bnp   = enju.get_bnp
rel   = enju.get_rel
focus = enju.get_focus

###### psparql = Sparql.pseudo(head, bnp, rel, focus)
## delete 'me', in, e.g. "find me" or "show me"
head.delete_if {|h| enju.idx_get_word(h) == 'me'}
rel.delete_if {|s, p, o| (enju.idx_get_word(s) == 'me') or (enju.idx_get_word(o) == 'me')}

## variable assignment
v_hash = {}
v = 'a'
head.each do |h|
  v_hash[h] = v
  v = v.next
end

## focusing
psparql = ""
psparql = "Select ?#{v_hash[focus]}\nWhere {\n"

## instantiation
head.each do |h|
  psparql += "\t?#{v_hash[h]}\trdf:type\t[#{enju.idxv_get_word(bnp[h]).join(', ')}];\n"
end

## relation
rel.each do |s, p, o|
  psparql += "\t?#{v_hash[s]}\t[#{enju.idxv_get_word(p).join(', ')}]\t?#{v_hash[o]};\n"
end

psparql += "}"
#####


## stand-off annotation (embed annotation is not allowed)
bnc_so = enju.get_bnc_so

so = []
bnc_so.each {|c| so << c.push("BNC")}

atext, last = '', 0
so.each do |cbeg, cend, label|
  atext += text[last...cbeg]
  atext += "<span class='#{label}'>"
  atext += text[cbeg...cend]
  atext += '</span>'
  last = cend
end
atext += text[last..-1]


## keywords for ontofinder
terms = ''
bnc_so.each do |cbeg, cend|
  terms += "\r\n" unless terms.empty?
  terms += text[cbeg...cend]
end


## enju PAS graph
enju.gen_pasgraph("_pas_graph.png")


## output
#puts psparql
tmpl_result = File.read("vis_annotation.html.erb")
result = ERB.new(tmpl_result).result

print "Content-type: text/html\n\n"
print result
