#!/usr/bin/env ruby
module Sparql
  def Sparql.pseudo (head, bnp, rel, focus)
    ## variable assignment
    v_hash = {}
    v = 'a'
    head.each do |h|
      v_hash[h] = v
      v = v.next
    end

    ## focusing
    psparql = "Select ?#{v_hash[focus]}\nWhere {\n"

    ## instantiation
    head.each do |h|
#      p enju.idxv_get_word(bnp[h])
      psparql += "\t?#{v_hash[h]}\trdf:type\t[#{enju.idxv_get_word(bnp[h]).join(', ')}];\n"
    end

    ## relation
    rel.each do |s, p, o|
      psparql += "#{s}, #{p}, #{o}\n"
      psparql += "\t#{v_hash[s]}\t[#{p.join(', ')}]\t?#{v_hash[o]};\n"
    end

    psparql[-2, 1] = '.'

    psparql += "}"
  end

end
