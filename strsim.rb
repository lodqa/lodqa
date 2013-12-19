#!/usr/bin/env ruby

module Strsim
  # This method is not currently called by anything--consider
  # deleting it or commenting it out. 
  def Strsim.overlap (str1, str2)
    fv1 = Strsim.get_trigrams(str1)
    fv2 = Strsim.get_trigrams(str2)
    fv_common = fv1 & fv2

    overlap = fv_common.size.to_f / [fv1.size, fv2.size].min
  end

  # Calculates Jaccard similarity coefficient based on character
  # trigrams.
  # TODO Add basic error-handling code.
  def Strsim.jaccard (str1, str2)
    fv1 = Strsim.get_trigrams(str1)
    fv2 = Strsim.get_trigrams(str2)
    fv_common = fv1 & fv2
    fv_union = fv1 | fv2

    jaccard = fv_common.size.to_f / fv_union.size
  end

  # Returns character trigrams (not word trigrams).
  def Strsim.get_trigrams (str)
    return [] if str.nil? or str.empty?
    fstr = '__' + str + '__'

    trigrams = []
    for i in (0...(fstr.length-2))
      trigrams.push(fstr.slice(i, 3))
    end
    trigrams.uniq
  end
end

if __FILE__ == $0
  ARGF.each do |l|
    s1, s2 = l.chomp.split("\t")
    # puts Strsim.overlap(s1, s2)
    puts Strsim.jaccard(s1, s2)
  end
end
